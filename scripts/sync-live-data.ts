import fs from 'fs';
import path from 'path';

const LIVE_BACKEND_URL = process.env.LIVE_BACKEND_URL || 'https://apex-academy-backend-f0lg.onrender.com';
const LOCAL_BACKEND_URL = process.env.LOCAL_BACKEND_URL || 'http://localhost:4000';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'kampuserp@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Aliadnan786@';

function getLocalSnapshotPath(): string {
  const isBackendDir = process.cwd().endsWith('backend');
  return path.resolve(process.cwd(), isBackendDir ? '../..' : '.', '.local-store-snapshot.json');
}

async function syncLiveData() {
  console.log(`🔄 Authenticating with live backend at ${LIVE_BACKEND_URL}...`);
  const liveLoginRes = await fetch(`${LIVE_BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
    }),
  });

  if (!liveLoginRes.ok) {
    const errText = await liveLoginRes.text();
    throw new Error(`Failed to login to live backend: ${liveLoginRes.status} ${errText}`);
  }

  const liveLoginData = (await liveLoginRes.json()) as any;
  const liveToken = liveLoginData.data?.token;
  if (!liveToken) {
    throw new Error('No token returned from live backend.');
  }

  console.log(`📥 Exporting live database snapshot...`);
  const exportRes = await fetch(`${LIVE_BACKEND_URL}/api/v1/saas/backups/export`, {
    headers: { Authorization: `Bearer ${liveToken}` },
  });

  if (!exportRes.ok) {
    const errText = await exportRes.text();
    throw new Error(`Failed to export from live backend: ${exportRes.status} ${errText}`);
  }

  const backupFile = (await exportRes.json()) as any;
  const academyCount = backupFile.academy_count || 0;
  console.log(`✅ Received live backup with ${academyCount} academy record(s).`);

  const rootSnapshotPath = getLocalSnapshotPath();
  fs.writeFileSync(rootSnapshotPath, JSON.stringify(backupFile.payload, null, 2), 'utf-8');
  console.log(`💾 Saved live snapshot to local disk at ${rootSnapshotPath}`);

  // If local server is running, push to it directly
  try {
    const localCheck = await fetch(`${LOCAL_BACKEND_URL}/api/v1/health`).catch(() => null);
    if (localCheck && localCheck.ok) {
      console.log(`🔁 Local backend is running. Applying snapshot to running local instance...`);
      const localLoginRes = await fetch(`${LOCAL_BACKEND_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
        }),
      });

      if (localLoginRes.ok) {
        const localLoginData = (await localLoginRes.json()) as any;
        const localToken = localLoginData.data?.token;
        const importRes = await fetch(`${LOCAL_BACKEND_URL}/api/v1/saas/backups/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localToken}`,
          },
          body: JSON.stringify(backupFile),
        });

        if (importRes.ok) {
          console.log(`🎉 Successfully applied live snapshot to running local server!`);
        }
      }
    }
  } catch (err: any) {
    console.log(`ℹ️ Local server update skipped (${err.message}). Local file snapshot is updated for next boot.`);
  }

  console.log(`\n✨ Sync complete! All live academies and user accounts are now available on localhost.`);
}

syncLiveData().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
