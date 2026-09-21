import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

const WEEKDAY_MAP: Record<number, WeekDay> = {
  0: WeekDay.SUNDAY,
  1: WeekDay.MONDAY,
  2: WeekDay.TUESDAY,
  3: WeekDay.WEDNESDAY,
  4: WeekDay.THURSDAY,
  5: WeekDay.FRIDAY,
  6: WeekDay.SATURDAY,
};

interface InputDto {
  userId: string;
  date: string; // YYYY-MM-DD
}

interface TodayWorkoutDay {
  workoutPlanId: string;
  id: string;
  name: string;
  isRest: boolean;
  weekDay: string;
  estimatedDurationInSeconds: number;
  coverImageUrl?: string;
  exercisesCount: number;
}

interface ConsistencyDay {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
}

export interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: TodayWorkoutDay;
  workoutStreak: number;
  consistencyByDay: Record<string, ConsistencyDay>;
}

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const currentDate = dayjs.utc(dto.date, "YYYY-MM-DD");

    // Find the active workout plan for this user
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            exercises: true,
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      throw new Error("No active workout plan found");
    }

    // Find today's workout day based on the day of the week
    const currentWeekDay = WEEKDAY_MAP[currentDate.day()];
    const todayWorkoutDay = activeWorkoutPlan.workoutDays.find(
      (day) => day.weekDay === currentWeekDay,
    );

    if (!todayWorkoutDay) {
      throw new Error("No workout day found for the given date");
    }

    // Calculate week range (Sunday 00:00:00 to Saturday 23:59:59 UTC)
    const weekStart = currentDate.day(0).startOf("day"); // Sunday
    const weekEnd = currentDate.day(6).endOf("day"); // Saturday

    // Fetch all workout sessions within the week range
    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    // Build consistencyByDay — include ALL days of the week
    const consistencyByDay: Record<string, ConsistencyDay> = {};
    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day");
      const dayKey = day.format("YYYY-MM-DD");

      const daySessions = weekSessions.filter(
        (session) => dayjs.utc(session.startedAt).format("YYYY-MM-DD") === dayKey,
      );

      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (session) => session.completedAt !== null,
      );

      consistencyByDay[dayKey] = {
        workoutDayCompleted,
        workoutDayStarted,
      };
    }

    // Calculate workout streak
    const workoutStreak = await this.calculateStreak(dto.userId, currentDate);

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: activeWorkoutPlan.id,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
        exercisesCount: todayWorkoutDay.exercises.length,
      },
      workoutStreak,
      consistencyByDay,
    };
  }

  /**
   * Calculates consecutive days where the user completed a workout session
   * (including rest days). Counts backward from the day before the given date.
   */
  private async calculateStreak(
    userId: string,
    currentDate: dayjs.Dayjs,
  ): Promise<number> {
    // Get the active plan's workout days to know the schedule
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        workoutDays: true,
      },
    });

    if (!activeWorkoutPlan) {
      return 0;
    }

    // Map of which week days have workout days in the plan
    const scheduledWeekDays = new Set(
      activeWorkoutPlan.workoutDays.map((day) => day.weekDay),
    );

    // Get rest day week days
    const restDayWeekDays = new Set(
      activeWorkoutPlan.workoutDays
        .filter((day) => day.isRest)
        .map((day) => day.weekDay),
    );

    // Get all completed sessions for this user's active plan
    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: activeWorkoutPlan.id,
        },
        completedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    // Create a set of dates with completed sessions
    const completedDates = new Set(
      completedSessions.map((session) =>
        dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
      ),
    );

    let streak = 0;
    let checkDate = currentDate.subtract(1, "day");

    // Count backward from yesterday
    while (true) {
      const dateKey = checkDate.format("YYYY-MM-DD");
      const weekDay = WEEKDAY_MAP[checkDate.day()];

      // If this day is not a scheduled day, skip it (don't break streak)
      if (!scheduledWeekDays.has(weekDay)) {
        checkDate = checkDate.subtract(1, "day");
        continue;
      }

      // If this is a rest day, it counts as completed automatically
      if (restDayWeekDays.has(weekDay)) {
        streak++;
        checkDate = checkDate.subtract(1, "day");
        continue;
      }

      // If it's a training day, check if completed
      if (completedDates.has(dateKey)) {
        streak++;
        checkDate = checkDate.subtract(1, "day");
        continue;
      }

      // Not completed — streak broken
      break;
    }

    return streak;
  }
}
