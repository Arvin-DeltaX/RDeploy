import nodemailer from "nodemailer";

function createTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: parseInt(process.env.SMTP_PORT ?? "587", 10) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

export async function sendDeploySuccess(
  to: string,
  projectName: string,
  teamName: string,
  projectUrl: string
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[email] SMTP_HOST not configured — skipping deploy success email");
    return;
  }

  const from = process.env.SMTP_FROM ?? "RDeploy <noreply@rdeploy.deltaxs.co>";
  const subject = `✅ ${projectName} deployed successfully`;

  const text = [
    `Good news — your project was deployed successfully!`,
    ``,
    `Project:  ${projectName}`,
    `Team:     ${teamName}`,
    `Live URL: ${projectUrl}`,
    ``,
    `— RDeploy`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#16a34a">✅ Deployed successfully</h2>
  <p>Your project was deployed successfully.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">Project</td>
      <td style="padding:6px 0">${escapeHtml(projectName)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">Team</td>
      <td style="padding:6px 0">${escapeHtml(teamName)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">Live URL</td>
      <td style="padding:6px 0"><a href="${escapeHtml(projectUrl)}">${escapeHtml(projectUrl)}</a></td>
    </tr>
  </table>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">— RDeploy</p>
</body>
</html>`;

  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (err) {
    console.error("[email] Failed to send deploy success email:", err);
  }
}

export async function sendDeployFailure(
  to: string,
  projectName: string,
  teamName: string,
  logsSnippet: string
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[email] SMTP_HOST not configured — skipping deploy failure email");
    return;
  }

  const from = process.env.SMTP_FROM ?? "RDeploy <noreply@rdeploy.deltaxs.co>";
  const subject = `❌ ${projectName} deploy failed`;

  // Last 20 lines of logs
  const last20Lines = logsSnippet
    .split("\n")
    .filter((l) => l.trim() !== "")
    .slice(-20)
    .join("\n");

  const text = [
    `Unfortunately, your project deploy failed.`,
    ``,
    `Project: ${projectName}`,
    `Team:    ${teamName}`,
    ``,
    `--- Last log lines ---`,
    last20Lines,
    `---------------------`,
    ``,
    `Check the deploy logs in RDeploy for the full output.`,
    ``,
    `— RDeploy`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#dc2626">❌ Deploy failed</h2>
  <p>Unfortunately, your project deploy failed.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">Project</td>
      <td style="padding:6px 0">${escapeHtml(projectName)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">Team</td>
      <td style="padding:6px 0">${escapeHtml(teamName)}</td>
    </tr>
  </table>
  <p style="font-weight:600;margin-top:16px">Last log lines:</p>
  <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;white-space:pre-wrap">${escapeHtml(last20Lines)}</pre>
  <p style="margin-top:16px">Check the deploy logs in RDeploy for the full output.</p>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">— RDeploy</p>
</body>
</html>`;

  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (err) {
    console.error("[email] Failed to send deploy failure email:", err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
