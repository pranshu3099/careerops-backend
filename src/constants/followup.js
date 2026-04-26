export const FOLLOWUPTYPE = {
  APPLICATION_CHECK: "APPLICATION_CHECK",
  INTERVIEW_REQUEST: "INTERVIEW_REQUEST",
  INTERVIEW_FEEDBACK: "INTERVIEW_FEEDBACK",
};

export const getFollowUpMessage = (type, numberOfdays = null) => {
  switch (type) {
    case FOLLOWUPTYPE.APPLICATION_CHECK:
      return numberOfdays === 3
        ? "Followup scheduled for application status"
        : numberOfdays === 7
          ? "Reminder scheduled for application review"
          : "Final Reminder scheduled for application review";
    case FOLLOWUPTYPE.INTERVIEW_REQUEST:
      return "Requested to proceed with interview round";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return "Requested interview feedback";
    default:
        return "Invalid type"
  }
};
