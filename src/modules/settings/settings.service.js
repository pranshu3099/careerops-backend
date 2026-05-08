import {
  getOrCreateSettings,
  updateSettings,
} from "./settings.repo.js";

const toFollowUpAlertSettingsResponse = (settings) => ({
  followUpAlertsEnabled: settings.followUpAlertsEnabled,
  followUpAlertDays: settings.followUpAlertDays,
});

export class SettingsService {
  static async getFollowUpAlertSettings(userId) {
    const settings = await getOrCreateSettings(userId);
    return toFollowUpAlertSettingsResponse(settings);
  }

  static async updateFollowUpAlertSettings(userId, data) {
    const settings = await updateSettings(userId, data);
    return toFollowUpAlertSettingsResponse(settings);
  }
}
