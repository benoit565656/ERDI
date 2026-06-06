import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/sdmx/structure/:resource/:agency/:id/:version
router.get('/:resource/:agency/:id/:version', async (req: Request, res: Response): Promise<void> => {
  try {
    const { resource, agency, id, version } = req.params;
    const format = res.locals.format || 'jsondata';

    const header = {
      id: `STR_${Date.now()}`,
      prepared: new Date().toISOString(),
      sender: { id: agency || 'ERDI' },
    };

    if (resource === 'dataflow') {
      const where: any = {};
      if (id && id !== 'all' && id !== '*') {
        where.code = id;
      }
      
      const dataflows = await prisma.dataflow.findMany({
        where,
        orderBy: { code: 'asc' },
      });

      res.status(200).json({
        header,
        dataflows: dataflows.map(df => ({
          id: df.code,
          dataset: df.datasetCode,
          name: df.name,
          description: df.description,
          level: df.dataflowLevel,
          parent: df.parentCode,
          mainDataflow: df.mainDataflowCode,
        })),
      });
      return;
    }

    if (resource === 'codelist') {
      const where: any = {};
      if (id && id !== 'all' && id !== '*') {
        where.code = id;
      }

      const codeLists = await prisma.codeList.findMany({
        where,
        include: {
          codeListItems: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      res.status(200).json({
        header,
        codelists: codeLists.map(cl => ({
          id: cl.code,
          name: cl.name,
          description: cl.description,
          items: cl.codeListItems.map(item => ({
            id: item.itemCode,
            name: item.itemName,
            description: item.description,
            parent: item.parentItemCode,
          })),
        })),
      });
      return;
    }

    if (resource === 'conceptscheme') {
      const where: any = {};
      if (id && id !== 'all' && id !== '*') {
        where.code = id;
      }

      const conceptSchemes = await prisma.conceptScheme.findMany({
        where,
        include: {
          concepts: true,
        },
      });

      res.status(200).json({
        header,
        conceptSchemes: conceptSchemes.map(cs => ({
          id: cs.code,
          name: cs.name,
          description: cs.description,
          concepts: cs.concepts.map(c => ({
            id: c.code,
            name: c.name,
            description: c.description,
            codeList: c.codeListCode,
          })),
        })),
      });
      return;
    }

    if (resource === 'datastructure') {
      const where: any = {};
      if (id && id !== 'all' && id !== '*') {
        where.code = id;
      }

      const dsds = await prisma.dsd.findMany({
        where,
        include: {
          components: true,
        },
      });

      res.status(200).json({
        header,
        datastructures: dsds.map(dsd => ({
          id: dsd.code,
          name: dsd.name,
          description: dsd.description,
          components: dsd.components.map(comp => ({
            id: comp.componentCode,
            type: comp.componentType,
            concept: comp.conceptCode,
            codeList: comp.codeListCode,
            isRequired: comp.isRequired,
            attachmentLevel: comp.attachmentLevel,
          })),
        })),
      });
      return;
    }

    if (resource === 'agencyscheme') {
      const where: any = {};
      if (id && id !== 'all' && id !== '*') {
        where.code = id;
      }

      const agencies = await prisma.agency.findMany({
        where,
      });

      res.status(200).json({
        header,
        agencies: agencies.map(a => ({
          id: a.code,
          name: a.name,
          description: a.description,
        })),
      });
      return;
    }

    res.status(501).json({
      error: 'Not Implemented',
      message: `Structure resource type '${resource}' is not supported or not yet implemented.`,
    });
  } catch (err: any) {
    console.error('Error fetching structure:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

export default router;
