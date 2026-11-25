import { spawn } from "node:child_process";

const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";

const child = spawn(
  GH,
  ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web", "--skip-ssh-key"],
  { stdio: ["pipe", "pipe", "pipe"] }
);

let codeSeen = false;
let opened = false;

const onData = (buf) => {
  const text = buf.toString();
  process.stdout.write(text);
  if (!codeSeen) {
    const m = text.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/);
    if (m) {
      codeSeen = true;
      console.log(`\n>>> DEVICE_CODE=${m[0]}`);
      setTimeout(() => {
        if (opened) return;
        opened = true;
        console.log(">>> sending ENTER to open the browser");
        child.stdin.write("\n");
        setTimeout(() => {
          console.log(">>> sending y (authenticate git)");
          child.stdin.write("y\n");
        }, 4000);
      }, 2500);
    }
  }
};

child.stdout.on("data", onData);
child.stderr.on("data", onData);
child.on("exit", (code) => {
  console.log(`\n>>> gh exited with ${code}`);
  process.exit(code ?? 0);
});
