import { prisma } from '../../db';

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

    return setting;
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
    const current = await this.getSetting();

    return prisma.storeSetting.update({
      where: { id: current.id },
      data,
    });
  }
}
