import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean().default(false),
      estimatedDurationInSeconds: z.number().min(1),
      imageUrl: z.string().url().optional(),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});

export const StartWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.uuid(),
  workoutDayId: z.uuid(),
});

export const StartWorkoutSessionResponseSchema = z.object({
  userWorkoutSessionId: z.uuid(),
});

export const UpdateWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.uuid(),
  workoutDayId: z.uuid(),
  sessionId: z.uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.iso.datetime(),
});

export const UpdateWorkoutSessionResponseSchema = z.object({
  id: z.uuid(),
  completedAt: z.string(),
  startedAt: z.string(),
});

export const HomeParamsSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const HomeResponseSchema = z.object({
  activeWorkoutPlanId: z.string(),
  todayWorkoutDay: z.object({
    workoutPlanId: z.string(),
    id: z.string(),
    name: z.string(),
    isRest: z.boolean(),
    weekDay: z.enum(WeekDay),
    estimatedDurationInSeconds: z.number(),
    coverImageUrl: z.string().optional(),
    exercisesCount: z.number(),
  }),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const GetWorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      weekDay: z.enum(WeekDay),
      name: z.string(),
      isRest: z.boolean(),
      coverImageUrl: z.url().optional(),
      estimatedDurationInSeconds: z.number(),
      exercisesCount: z.number(),
    }),
  ),
});

export const GetWorkoutDayParamsSchema = z.object({
  workoutPlanId: z.uuid(),
  workoutDayId: z.uuid(),
});

export const GetWorkoutDaySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().optional(),
  estimatedDurationInSeconds: z.number(),
  weekDay: z.enum(WeekDay),
  exercises: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      order: z.number(),
      sets: z.number(),
      reps: z.number(),
      restTimeInSeconds: z.number(),
      workoutDayId: z.uuid(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      workoutDayId: z.uuid(),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
    }),
  ),
});

export const StatsQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export const StatsResponseSchema = z.object({
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number(),
  conclusionRate: z.number(),
  totalTimeInSeconds: z.number(),
});

export const ListWorkoutPlansQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const ListWorkoutPlansSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        weekDay: z.enum(WeekDay),
        isRest: z.boolean(),
        estimatedDurationInSeconds: z.number(),
        coverImageUrl: z.url().optional(),
        exercises: z.array(
          z.object({
            id: z.uuid(),
            order: z.number(),
            name: z.string(),
            sets: z.number(),
            reps: z.number(),
            restTimeInSeconds: z.number(),
          }),
        ),
      }),
    ),
  }),
);

export const UpsertUserTrainDataBodySchema = z.object({
  weightInGrams: z.number().min(0),
  heightInCentimeters: z.number().min(0),
  age: z.number().min(0),
  bodyFatPercentage: z.number().min(0).max(100),
});

export const UserTrainDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: z.number(),
  heightInCentimeters: z.number(),
  age: z.number(),
  bodyFatPercentage: z.number().min(0).max(100),
});

export const UpsertUserTrainDataSchema = z.object({
  userId: z.string(),
  weightInGrams: z.number(),
  heightInCentimeters: z.number(),
  age: z.number(),
  bodyFatPercentage: z.number(),
});
