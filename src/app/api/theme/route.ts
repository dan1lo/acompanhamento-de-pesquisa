import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  let isDark: boolean | null = null;

  if (process.platform === "win32") {
    try {
      const out = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v SystemUsesLightTheme',
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );
      if (out.includes("0x0")) {
        isDark = true;
      } else if (out.includes("0x1")) {
        isDark = false;
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ isDark });
}
