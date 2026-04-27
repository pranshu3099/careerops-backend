export const FOLLOWUPTYPE = {
  APPLICATION_CHECK: "APPLICATION_CHECK",
  SHORTLISTED_CHECKIN: "SHORTLISTED_CHECKIN",
  INTERVIEW_FEEDBACK: "INTERVIEW_FEEDBACK",
  OFFER_FOLLOWUP: "OFFER_FOLLOWUP",
  GENERAL_STATUS_CHECK: "GENERAL_STATUS_CHECK",
};

export const FOLLOWUP_SCHEDULE_DAYS = {
  [FOLLOWUPTYPE.APPLICATION_CHECK]: [3, 7, 14],
  [FOLLOWUPTYPE.SHORTLISTED_CHECKIN]: [3],
  [FOLLOWUPTYPE.INTERVIEW_FEEDBACK]: [5],
  [FOLLOWUPTYPE.OFFER_FOLLOWUP]: [3],
};

export const FOLLOWUP_TYPE_BY_STATUS = {
  SHORTLISTED: FOLLOWUPTYPE.SHORTLISTED_CHECKIN,
  INTERVIEWING: FOLLOWUPTYPE.INTERVIEW_FEEDBACK,
  OFFERED: FOLLOWUPTYPE.OFFER_FOLLOWUP,
};

export const getFollowUpMessage = (type, sequence = 1) => {
  switch (type) {
    case FOLLOWUPTYPE.APPLICATION_CHECK:
      if (sequence === 1) return "First application status check scheduled.";
      if (sequence === 2) return "Second application status check scheduled.";
      return "Final application status check scheduled.";
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return "You were shortlisted, checking if interview got scheduled.";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return "Checking for interview feedback/update.";
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return "Reminder to respond/close loop on offer.";
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return "Generic follow-up.";
    default:
      return "Generic follow-up.";
  }
};

export const getFollowUpDelayMs = (type, sequence = 1) => {
  const days = FOLLOWUP_SCHEDULE_DAYS[type]?.[sequence - 1];
  return days ? days * 24 * 60 * 60 * 1000 : 0;
};
