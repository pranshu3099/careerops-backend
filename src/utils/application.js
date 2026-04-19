export default function mapSource(platform) {
  switch (platform?.toLowerCase()) {
    case "linkedin":
      return "LINKEDIN";
    case "naukri":
      return "NAUKRI";
    case "referral":
      return "REFERRAL";
    case "career page":
      return "CAREER_PAGE";
    default:
      return "OTHER";
  }
}

export default function isValidTransition(oldStatus, newStatus) {
  const allowed = {
    APPLIED: ["SHORTLISTED", "REJECTED"],
    SHORTLISTED: ["INTERVIEWING"],
    INTERVIEWING: ["OFFERED", "REJECTED"],
  };

  return allowed[oldStatus]?.includes(newStatus);
}
