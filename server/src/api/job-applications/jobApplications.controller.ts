import type { Request, Response } from 'express';
import { z } from 'zod';
import { JobApplicationStatus, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { parseJobLink } from './jobApplications.parseLink';

const STATUSES = [
  'SAVED',
  'APPLIED',
  'OA',
  'INTERVIEW',
  'REJECTED',
  'OFFER',
] as const satisfies readonly JobApplicationStatus[];

const statusSchema = z.enum(STATUSES);

const tagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(12)
  .optional()
  .transform((t) => (t ? [...new Set(t.map((s) => s.slice(0, 32)))] : undefined));

const optionalHttpUrl = z
  .union([z.literal(''), z.string().trim().url().max(2000)])
  .optional()
  .nullable()
  .transform((v) => (v === '' || v === undefined ? null : v));

const createBodySchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  applicationUrl: optionalHttpUrl,
  notes: z.string().max(8000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  tags: tagsSchema,
  status: statusSchema.optional(),
});

const patchBodySchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().min(1).max(200).optional(),
  applicationUrl: optionalHttpUrl,
  notes: z.string().max(8000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  tags: tagsSchema,
  status: statusSchema.optional(),
});

const reorderBodySchema = z.object({
  columns: z.record(statusSchema, z.array(z.string().min(1))),
});

const parseLinkBodySchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

const applicationSelect = {
  id: true,
  userId: true,
  status: true,
  company: true,
  role: true,
  applicationUrl: true,
  notes: true,
  deadline: true,
  appliedAt: true,
  tags: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JobApplicationSelect;

function serializeApp(row: Prisma.JobApplicationGetPayload<{ select: typeof applicationSelect }>) {
  return {
    ...row,
    deadline: row.deadline?.toISOString() ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeActivity(
  row: Prisma.JobApplicationActivityGetPayload<{
    select: {
      id: true;
      kind: true;
      fromStatus: true;
      toStatus: true;
      createdAt: true;
    };
  }>
) {
  return {
    id: row.id,
    kind: row.kind,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

async function nextSortOrder(userId: string, status: JobApplicationStatus): Promise<number> {
  const agg = await prisma.jobApplication.aggregate({
    where: { userId, status },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

export async function listJobApplications(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const rows = await prisma.jobApplication.findMany({
      where: { userId },
      select: applicationSelect,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json({ applications: rows.map(serializeApp) });
  } catch (e) {
    console.error('listJobApplications', e);
    res.status(500).json({ message: 'Failed to load applications' });
  }
}

export async function getJobApplication(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const row = await prisma.jobApplication.findFirst({
      where: { id, userId },
      select: {
        ...applicationSelect,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            kind: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    const { activities, ...app } = row;
    res.json({
      application: serializeApp(app),
      activities: activities.map(serializeActivity),
    });
  } catch (e) {
    console.error('getJobApplication', e);
    res.status(500).json({ message: 'Failed to load application' });
  }
}

export async function createJobApplication(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const body = createBodySchema.parse(req.body);
    const status = body.status ?? 'SAVED';
    const sortOrder = await nextSortOrder(userId, status);

    const deadline = body.deadline ? new Date(body.deadline) : null;
    const appliedAt = status === 'APPLIED' ? new Date() : null;

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.jobApplication.create({
        data: {
          userId,
          status,
          company: body.company,
          role: body.role,
          applicationUrl: body.applicationUrl ?? null,
          notes: body.notes ?? null,
          deadline,
          appliedAt,
          tags: body.tags ?? [],
          sortOrder,
        },
        select: applicationSelect,
      });
      await tx.jobApplicationActivity.create({
        data: {
          applicationId: created.id,
          kind: 'created',
          toStatus: status,
        },
      });
      return created;
    });

    res.status(201).json({ application: serializeApp(row) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: e.flatten() });
    }
    console.error('createJobApplication', e);
    res.status(500).json({ message: 'Failed to create application' });
  }
}

export async function patchJobApplication(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = patchBodySchema.parse(req.body);

    const existing = await prisma.jobApplication.findFirst({
      where: { id, userId },
      select: { id: true, status: true, appliedAt: true },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }

    const data: Prisma.JobApplicationUpdateInput = {};
    if (body.company !== undefined) data.company = body.company;
    if (body.role !== undefined) data.role = body.role;
    if (body.applicationUrl !== undefined) data.applicationUrl = body.applicationUrl;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.deadline !== undefined) {
      data.deadline = body.deadline ? new Date(body.deadline) : null;
    }
    if (body.tags !== undefined) data.tags = body.tags;

    let statusChanged = false;
    if (body.status !== undefined && body.status !== existing.status) {
      statusChanged = true;
      data.status = body.status;
      if (body.status === 'APPLIED' && !existing.appliedAt) {
        data.appliedAt = new Date();
      }
    }

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.jobApplication.update({
        where: { id },
        data,
        select: applicationSelect,
      });
      if (statusChanged && body.status) {
        await tx.jobApplicationActivity.create({
          data: {
            applicationId: id,
            kind: 'status_change',
            fromStatus: existing.status,
            toStatus: body.status,
          },
        });
      }
      return updated;
    });

    res.json({ application: serializeApp(row) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: e.flatten() });
    }
    console.error('patchJobApplication', e);
    res.status(500).json({ message: 'Failed to update application' });
  }
}

export async function reorderJobApplications(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const body = reorderBodySchema.parse(req.body);

    for (const s of STATUSES) {
      if (!(s in body.columns)) {
        return res.status(400).json({ message: `Missing column: ${s}` });
      }
    }

    const allIds = STATUSES.flatMap((s) => body.columns[s]!);
    const unique = new Set(allIds);
    if (unique.size !== allIds.length) {
      return res.status(400).json({ message: 'Duplicate application ids in payload' });
    }

    const owned = await prisma.jobApplication.findMany({
      where: { userId },
      select: { id: true, status: true, appliedAt: true },
    });
    if (owned.length !== allIds.length) {
      return res.status(400).json({ message: 'Column ids must include every application exactly once' });
    }
    const ownedSet = new Set(owned.map((o) => o.id));
    for (const id of allIds) {
      if (!ownedSet.has(id)) {
        return res.status(400).json({ message: 'Unknown application id' });
      }
    }

    const prevById = new Map(owned.map((o) => [o.id, o]));

    await prisma.$transaction(async (tx) => {
      for (const status of STATUSES) {
        const ids = body.columns[status]!;
        let order = 0;
        for (const applicationId of ids) {
          const prev = prevById.get(applicationId)!;
          const becomesApplied = status === 'APPLIED' && prev.status !== 'APPLIED';
          const setAppliedAt = becomesApplied && !prev.appliedAt ? { appliedAt: new Date() } : {};

          await tx.jobApplication.update({
            where: { id: applicationId },
            data: {
              status,
              sortOrder: order++,
              ...setAppliedAt,
            },
          });
          if (prev.status !== status) {
            await tx.jobApplicationActivity.create({
              data: {
                applicationId,
                kind: 'status_change',
                fromStatus: prev.status,
                toStatus: status,
              },
            });
          }
        }
      }
    });

    const rows = await prisma.jobApplication.findMany({
      where: { userId },
      select: applicationSelect,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json({ applications: rows.map(serializeApp) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: e.flatten() });
    }
    console.error('reorderJobApplications', e);
    res.status(500).json({ message: 'Failed to reorder' });
  }
}

export async function deleteJobApplication(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const result = await prisma.jobApplication.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.status(204).send();
  } catch (e) {
    console.error('deleteJobApplication', e);
    res.status(500).json({ message: 'Failed to delete' });
  }
}

export async function postParseJobLink(req: Request, res: Response) {
  try {
    const body = parseLinkBodySchema.parse(req.body);
    const parsed = await parseJobLink(body.url);
    res.json(parsed);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: e.flatten() });
    }
    console.error('postParseJobLink', e);
    res.status(500).json({ message: 'Failed to parse link' });
  }
}
