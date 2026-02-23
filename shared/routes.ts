import { z } from 'zod';
import {
  insertProjectSchema, projects,
  insertTeamMemberSchema, teamMembers,
  insertTaskSchema, tasks,
  insertTaskAssignmentSchema, taskAssignments,
  insertTaskDependencySchema, taskDependencies,
  insertHolidaySchema, holidays,
  createUserSchema, loginSchema, forgotPasswordRequestSchema, otpVerifySchema, passwordResetSchema, users,
  type FullProjectResponse,
  type DayWiseUtilization,
  type ProjectSummary
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: {
        200: z.object({
          id: z.number(),
          fullName: z.string(),
          username: z.string(),
          phone: z.string(),
          role: z.string(),
        }),
        401: errorSchemas.notFound,
      },
    },
    setupStatus: {
      method: "GET" as const,
      path: "/api/auth/setup-status" as const,
      responses: {
        200: z.object({
          hasUsers: z.boolean(),
          canBootstrap: z.boolean(),
          canManageUsers: z.boolean(),
        }),
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: loginSchema,
      responses: {
        200: z.object({
          id: z.number(),
          fullName: z.string(),
          username: z.string(),
          phone: z.string(),
          role: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout" as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    forgotPasswordRequest: {
      method: "POST" as const,
      path: "/api/auth/forgot-password/request" as const,
      input: forgotPasswordRequestSchema,
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
      },
    },
    forgotPasswordVerify: {
      method: "POST" as const,
      path: "/api/auth/forgot-password/verify" as const,
      input: otpVerifySchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
    forgotPasswordReset: {
      method: "POST" as const,
      path: "/api/auth/forgot-password/reset" as const,
      input: passwordResetSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
  },
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users" as const,
      responses: {
        200: z.array(z.custom<Omit<typeof users.$inferSelect, "passwordHash">>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/users" as const,
      input: createUserSchema,
      responses: {
        201: z.custom<Omit<typeof users.$inferSelect, "passwordHash">>(),
        400: errorSchemas.validation,
      },
    },
  },
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects' as const,
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id' as const,
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getFull: {
      method: 'GET' as const,
      path: '/api/projects/:id/full' as const,
      responses: {
        200: z.custom<FullProjectResponse>(),
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects' as const,
      input: insertProjectSchema,
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/projects/:id' as const,
      input: insertProjectSchema.partial(),
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    getSummary: {
      method: 'GET' as const,
      path: '/api/projects/:id/summary' as const,
      responses: {
        200: z.custom<ProjectSummary>(),
        404: errorSchemas.notFound,
      }
    },
    getUtilization: {
      method: 'GET' as const,
      path: '/api/projects/:id/utilization' as const,
      responses: {
        200: z.array(z.custom<DayWiseUtilization>()),
        404: errorSchemas.notFound,
      }
    },
    exportExcel: {
      method: 'GET' as const,
      path: '/api/projects/:id/export/excel' as const,
      responses: {
        200: z.void(),
        404: errorSchemas.notFound,
      }
    }
  },
  teamMembers: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/team' as const,
      responses: {
        200: z.array(z.custom<typeof teamMembers.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/team' as const,
      input: insertTeamMemberSchema.omit({ projectId: true }),
      responses: {
        201: z.custom<typeof teamMembers.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/team-members/:id' as const,
      input: insertTeamMemberSchema.partial(),
      responses: {
        200: z.custom<typeof teamMembers.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/team-members/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  },
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/tasks' as const,
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/tasks' as const,
      input: insertTaskSchema.omit({ projectId: true }),
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tasks/:id' as const,
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tasks/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  },
  taskAssignments: {
    create: {
      method: 'POST' as const,
      path: '/api/tasks/:taskId/assignments' as const,
      input: insertTaskAssignmentSchema.omit({ taskId: true }),
      responses: {
        201: z.custom<typeof taskAssignments.$inferSelect>(),
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/assignments/:id' as const,
      responses: {
        204: z.void(),
      }
    }
  },
  taskDependencies: {
    create: {
      method: 'POST' as const,
      path: '/api/tasks/:taskId/dependencies' as const,
      input: insertTaskDependencySchema.omit({ taskId: true }),
      responses: {
        201: z.custom<typeof taskDependencies.$inferSelect>(),
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/dependencies/:id' as const,
      responses: {
        204: z.void(),
      }
    }
  },
  holidays: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/holidays' as const,
      responses: {
        200: z.array(z.custom<typeof holidays.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/holidays' as const,
      input: insertHolidaySchema.omit({ projectId: true }),
      responses: {
        201: z.custom<typeof holidays.$inferSelect>(),
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/holidays/:id' as const,
      responses: {
        204: z.void(),
      }
    }
  },
  schedule: {
    generate: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/schedule' as const,
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ProjectSummaryResponse = z.infer<typeof api.projects.getSummary.responses[200]>;
export type UtilizationResponse = z.infer<typeof api.projects.getUtilization.responses[200]>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type InternalError = z.infer<typeof errorSchemas.internal>;
