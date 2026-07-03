import type { DomainHandler, DomainName } from '../utils/types.js';

const domainCache = new Map<DomainName, DomainHandler>();

export async function getDomainHandler(domain: DomainName): Promise<DomainHandler> {
  const cached = domainCache.get(domain);
  if (cached) return cached;

  let handler: DomainHandler;
  switch (domain) {
    case 'system': {
      const { systemHandler } = await import('./system.js');
      handler = systemHandler;
      break;
    }
    case 'orgs': {
      const { orgsHandler } = await import('./orgs.js');
      handler = orgsHandler;
      break;
    }
    case 'devices': {
      const { devicesHandler } = await import('./devices.js');
      handler = devicesHandler;
      break;
    }
    case 'monitoring': {
      const { monitoringHandler } = await import('./monitoring.js');
      handler = monitoringHandler;
      break;
    }
    case 'tasks': {
      const { tasksHandler } = await import('./tasks.js');
      handler = tasksHandler;
      break;
    }
    case 'custom-properties': {
      const { customPropertiesHandler } = await import('./custom-properties.js');
      handler = customPropertiesHandler;
      break;
    }
    case 'maintenance': {
      const { maintenanceHandler } = await import('./maintenance.js');
      handler = maintenanceHandler;
      break;
    }
    case 'access-groups': {
      const { accessGroupsHandler } = await import('./access-groups.js');
      handler = accessGroupsHandler;
      break;
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }

  domainCache.set(domain, handler);
  return handler;
}
