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
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface ConsistencyDay {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
}

export interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<string, ConsistencyDay>;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjs.utc(dto.from, "YYYY-MM-DD").startOf("day");
    const toDate = dayjs.utc(dto.to, "YYYY-MM-DD").endOf("day");

    // Fetch all workout sessions for this user within the date range
    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
    });

    // Group sessions by date (YYYY-MM-DD of startedAt)
    const sessionsByDay = new Map<
      string,
      Array<{ startedAt: Date; completedAt: Date | null }>
    >();
    for (const session of sessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      if (!sessionsByDay.has(dayKey)) {
        sessionsByDay.set(dayKey, []);
      }
      sessionsByDay.get(dayKey)!.push({
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      });
    }

    // Build consistencyByDay — only days that have at least one session
    const consistencyByDay: Record<string, ConsistencyDay> = {};
    for (const [dayKey, daySessions] of sessionsByDay) {
      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (session) => session.completedAt !== null,
      );

      consistencyByDay[dayKey] = {
        workoutDayCompleted,
        workoutDayStarted,
      };
    }

    // Count completed workouts
    const completedWorkoutsCount = sessions.filter(
      (session) => session.completedAt !== null,
    ).length;

    // Conclusion rate
    const conclusionRate =
      sessions.length > 0 ? completedWorkoutsCount / sessions.length : 0;

    // Total time in seconds (sum of completedAt - startedAt for completed sessions)
    const totalTimeInSeconds = sessions
      .filter((session) => session.completedAt !== null)
      .reduce((total, session) => {
        const start = dayjs.utc(session.startedAt);
        const end = dayjs.utc(session.completedAt!);
        return total + end.diff(start, "second");
      }, 0);

    // Calculate workout streak
    const workoutStreak = await this.calculateStreak(dto.userId, toDate);

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
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
