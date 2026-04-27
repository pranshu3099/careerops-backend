import nodemailer from "nodemailer";
import { FOLLOWUPTYPE } from "../constants/followup.js";

const buildFollowUpTemplate = ({
  type,
  sequence = 1,
  role,
  company,
  appliedDate,
  hrName,
  userName,
}) => {
  const greeting = `<p>Dear ${hrName},</p>`;
  const closing = `<p>Thank you for your time and consideration.</p><p>Warm regards,<br>${userName}</p>`;

  switch (type) {
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return `
        ${greeting}
        <p>I am writing to follow up on the <strong>${role}</strong> role at <strong>${company}</strong>. I was pleased to be shortlisted and wanted to check whether the next interview round has been scheduled.</p>
        <p>Please let me know if there is any information you need from my end.</p>
        ${closing}
      `;
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return `
        ${greeting}
        <p>I hope you are doing well. I wanted to follow up on my interview for the <strong>${role}</strong> role at <strong>${company}</strong> and check whether there is any feedback or update you can share.</p>
        <p>I remain interested in the opportunity and would appreciate any guidance on next steps.</p>
        ${closing}
      `;
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return `
        ${greeting}
        <p>I am following up on the offer discussion for the <strong>${role}</strong> role at <strong>${company}</strong>. I wanted to make sure the loop is closed and confirm if any action is pending from my side.</p>
        <p>Please let me know the best next step.</p>
        ${closing}
      `;
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return `
        ${greeting}
        <p>I hope this message finds you well. I wanted to follow up regarding the <strong>${role}</strong> position at <strong>${company}</strong> and check whether there is any update you can share.</p>
        ${closing}
      `;
    case FOLLOWUPTYPE.APPLICATION_CHECK:
    default:
      if (sequence === 2) {
        return `
          ${greeting}
          <p>I hope you are doing well. I wanted to send a polite reminder about my application for the <strong>${role}</strong> position at <strong>${company}</strong>, submitted on ${appliedDate}.</p>
          <p>I remain interested in the opportunity and would appreciate any update you can share.</p>
          ${closing}
        `;
      }

      if (sequence === 3) {
        return `
          ${greeting}
          <p>I am writing one final time to follow up on my application for the <strong>${role}</strong> position at <strong>${company}</strong>, submitted on ${appliedDate}.</p>
          <p>If the role has been filled or the team has moved forward with other candidates, I would appreciate a brief update.</p>
          ${closing}
        `;
      }

      return `
        ${greeting}
        <p>I hope this message finds you well. I am writing to follow up on my application for the <strong>${role}</strong> position at <strong>${company}</strong>, which I submitted on ${appliedDate}.</p>
        <p>I remain genuinely enthusiastic about this opportunity and would be grateful for any update you can share regarding my application status.</p>
        <p>Please do not hesitate to reach out if you require any additional information or documents from my end.</p>
        ${closing}
      `;
  }
};

export const sendFollowUpEmail = async ({
  followUpId,
  type = FOLLOWUPTYPE.APPLICATION_CHECK,
  sequence = 1,
  to,
  role,
  company,
  appliedDate,
  hrName,
  userName,
  userEmail,
}) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `${userName} <${userEmail}>`,
    to,
    subject: "Following Up",
    html: buildFollowUpTemplate({
      type,
      sequence,
      role,
      company,
      appliedDate,
      hrName,
      userName,
    }),
  });

  if (followUpId) {
    console.log(`Follow-up email sent for followUpId: ${followUpId}`);
  }
};
