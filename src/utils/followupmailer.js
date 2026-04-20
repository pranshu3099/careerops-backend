import nodemailer from "nodemailer";
export const sendFollowUpEmail = async ({
  followUpId,
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
    subject: "Following Up on My Application",
    html: `
      <p>Dear ${hrName},</p>
    <p>I hope this message finds you well. I am writing to follow up on my application for the <strong>${role}</strong> position at <strong>${company}</strong>, which I submitted on ${appliedDate}.</p>
    <p>I remain genuinely enthusiastic about this opportunity and would be grateful for any update you can share regarding my application status.</p>
    <p>Please do not hesitate to reach out if you require any additional information or documents from my end.</p>
    <p>Thank you for your time and consideration.</p>
    <p>Warm regards,<br>${userName}</p>
    `,
  });

  if (followUpId) {
    console.log(`Follow-up email sent for followUpId: ${followUpId}`);
  }
};
