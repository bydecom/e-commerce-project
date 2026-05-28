import { prisma } from '../../db';
import { resolveImageUrl } from '../../config/storage';

/** Resolve stored key/URL fields before returning to API consumers. */
function mapSetting(setting: Awaited<ReturnType<typeof prisma.storeSetting.findFirst>>) {
  if (!setting) return setting;
  return {
    ...setting,
    logoUrl: resolveImageUrl(setting.logoUrl),
  };
}

export class StoreSettingService {
  /** Returns the single store row, creating defaults if none exist. */
  static async getSetting() {
    let setting = await prisma.storeSetting.findFirst();

    if (!setting) {
      setting = await prisma.storeSetting.create({
        data: {
          name: 'My E-Commerce Shop',
          description: 'Welcome to our store.',
        },
      });
    }

    return mapSetting(setting);
  }

  /** Updates the single store row. */
  static async updateSetting(data: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
    description?: string | null;
  }) {
    const current = await prisma.storeSetting.findFirst();
    const id = current?.id ?? (await prisma.storeSetting.create({
      data: { name: 'My E-Commerce Shop', description: 'Welcome to our store.' },
    })).id;

    const updated = await prisma.storeSetting.update({ where: { id }, data });
    return mapSetting(updated);
  }
}
