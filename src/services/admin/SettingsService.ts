import { SettingsRepository } from "@/repositories/admin/SettingsRepository";

export class SettingsService {
  private settingsRepository: SettingsRepository;

  constructor() {
    this.settingsRepository = new SettingsRepository();
  }

  async getAllSettings() {
    const settings = await this.settingsRepository.findAll();
    return settings;
  }

  async getSettingByCode(code: string) {
    const setting = await this.settingsRepository.findByCode(code);
    if (!setting) {
      throw new Error("Setting not found");
    }
    return setting;
  }

  async updateSetting(settingId: string, value: string) {
    const setting = await this.settingsRepository.findById(settingId);
    if (!setting) {
      throw new Error("Setting not found");
    }

    setting.value = value;
    await setting.save();

    return { message: "Setting updated successfully", setting };
  }
}
