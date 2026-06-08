const { Resend } = require('resend');

let client;
function getClient() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function sendEnquiryNotification({ name, email, subject, message, work_title }) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_EMAIL) return;

  const workLine = work_title ? `Work: ${work_title}\n` : '';

  try {
    await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.NOTIFICATION_EMAIL,
      reply_to: email,
      subject: `New enquiry: ${subject}`,
      text: [
        `New enquiry from ${name} <${email}>`,
        workLine,
        message,
      ].filter(Boolean).join('\n'),
      html: `
        <p style="font-family:sans-serif;color:#555;margin:0 0 4px">
          New enquiry from <strong>${escHtml(name)}</strong>
          &lt;<a href="mailto:${escHtml(email)}">${escHtml(email)}</a>&gt;
        </p>
        ${work_title ? `<p style="font-family:sans-serif;color:#555;margin:0 0 16px">Work: <em>${escHtml(work_title)}</em></p>` : ''}
        <p style="font-family:sans-serif;color:#555;margin:0 0 4px"><strong>Subject:</strong> ${escHtml(subject)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="font-family:sans-serif;color:#333;white-space:pre-wrap">${escHtml(message)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="font-family:sans-serif;font-size:12px;color:#aaa">
          Reply to this email to respond directly to ${escHtml(name)}.
        </p>
      `,
    });
  } catch (err) {
    console.error('Email notification failed:', err.message);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendEnquiryNotification };
