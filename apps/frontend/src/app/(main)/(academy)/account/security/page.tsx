'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
export default function SecuritySettingsPage() {
  const auth = useAuth();
  const {
    user,
    changePassword,
    changeEmail,
    logoutEverywhere,
    getSessions,
    revokeSession,
    setup2fa,
    enable2fa,
    disable2fa,
  } = auth;
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [twoFactorStatus, setTwoFactorStatus] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorQr, setTwoFactorQr] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  useEffect(() => {
    loadSessions();
  }, []);
  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch {
    } finally {
      setSessionsLoading(false);
    }
  };
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess('Password changed successfully. You have been logged out of all devices.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);
    try {
      await changeEmail(emailForm.newEmail, emailForm.password);
      setEmailSuccess('Verification email sent to your new address. Please check your inbox.');
      setEmailForm({ newEmail: '', password: '' });
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to change email');
    } finally {
      setEmailLoading(false);
    }
  };
  const handleSetup2fa = async () => {
    setTwoFactorStatus('setup');
    setTwoFactorLoading(true);
    try {
      const result = await setup2fa();
      setTwoFactorSecret(result.secret);
      setTwoFactorQr(result.qrCode);
    } catch {
      setTwoFactorError('Failed to setup 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };
  const handleEnable2fa = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError('');
    try {
      const result = await enable2fa(twoFactorToken, twoFactorSecret);
      setTwoFactorBackupCodes(result.backupCodes);
      setTwoFactorStatus('verify');
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Failed to enable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };
  const handleDisable2fa = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) return;
    setTwoFactorLoading(true);
    try {
      const token = prompt('Enter your current 2FA code to disable:');
      if (!token) return;
      await disable2fa(token);
      setTwoFactorStatus('idle');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };
  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      loadSessions();
    } catch {
      alert('Failed to revoke session');
    }
  };
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {' '}
      <div>
        {' '}
        <h1 className="text-3xl font-bold tracking-tight">Account Security</h1>{' '}
        <p className="text-muted-foreground mt-1">
          Manage your password, email, and security settings.
        </p>{' '}
      </div>{' '}
      {user?.twoFactorEnabled && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-4 text-sm">
          {' '}
          <strong>Two-factor authentication is enabled.</strong> You&apos;ll need a code from your
          authenticator app to sign in.{' '}
        </div>
      )}{' '}
      <Card>
        {' '}
        <CardHeader>
          {' '}
          <CardTitle>Change Password</CardTitle>{' '}
          <CardDescription>
            Update your password. You&apos;ll be logged out of all devices.
          </CardDescription>{' '}
        </CardHeader>{' '}
        <CardContent>
          {' '}
          <form onSubmit={handleChangePassword} className="space-y-4">
            {' '}
            {pwError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {pwError}
              </div>
            )}{' '}
            {pwSuccess && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                {pwSuccess}
              </div>
            )}{' '}
            <div className="space-y-2">
              {' '}
              <Label htmlFor="currentPassword">Current Password</Label>{' '}
              <Input
                id="currentPassword"
                type="password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
              />{' '}
            </div>{' '}
            <div className="space-y-2">
              {' '}
              <Label htmlFor="newPassword">New Password</Label>{' '}
              <Input
                id="newPassword"
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                required
              />{' '}
            </div>{' '}
            <div className="space-y-2">
              {' '}
              <Label htmlFor="confirmPassword">Confirm New Password</Label>{' '}
              <Input
                id="confirmPassword"
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                required
              />{' '}
            </div>{' '}
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? 'Changing...' : 'Change Password'}
            </Button>{' '}
          </form>{' '}
        </CardContent>{' '}
      </Card>{' '}
      <Card>
        {' '}
        <CardHeader>
          {' '}
          <CardTitle>Change Email</CardTitle>{' '}
          <CardDescription>
            Update your email address. You&apos;ll need to verify the new address.
          </CardDescription>{' '}
        </CardHeader>{' '}
        <CardContent>
          {' '}
          <form onSubmit={handleChangeEmail} className="space-y-4">
            {' '}
            {emailError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {emailError}
              </div>
            )}{' '}
            {emailSuccess && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                {emailSuccess}
              </div>
            )}{' '}
            <div className="space-y-2">
              {' '}
              <Label htmlFor="newEmail">New Email</Label>{' '}
              <Input
                id="newEmail"
                type="email"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                required
              />{' '}
            </div>{' '}
            <div className="space-y-2">
              {' '}
              <Label htmlFor="emailPassword">Current Password</Label>{' '}
              <Input
                id="emailPassword"
                type="password"
                value={emailForm.password}
                onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                required
              />{' '}
            </div>{' '}
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? 'Sending...' : 'Send Verification'}
            </Button>{' '}
          </form>{' '}
        </CardContent>{' '}
      </Card>{' '}
      <Card>
        {' '}
        <CardHeader>
          {' '}
          <CardTitle>Two-Factor Authentication</CardTitle>{' '}
          <CardDescription>Add an extra layer of security to your account.</CardDescription>{' '}
        </CardHeader>{' '}
        <CardContent className="space-y-4">
          {' '}
          {twoFactorStatus === 'idle' && !user?.twoFactorEnabled && (
            <Button onClick={handleSetup2fa} disabled={twoFactorLoading}>
              {' '}
              Enable Two-Factor Authentication{' '}
            </Button>
          )}{' '}
          {twoFactorStatus === 'idle' && user?.twoFactorEnabled && (
            <Button variant="destructive" onClick={handleDisable2fa} disabled={twoFactorLoading}>
              {' '}
              Disable Two-Factor Authentication{' '}
            </Button>
          )}{' '}
          {twoFactorStatus === 'setup' && (
            <div className="space-y-4">
              {' '}
              <p className="text-sm text-muted-foreground">
                {' '}
                Scan this QR code with your authenticator app (e.g. Google Authenticator,
                Authy).{' '}
              </p>{' '}
              {twoFactorQr && (
                <div className="flex justify-center">
                  {' '}
                  <img src={twoFactorQr} alt="2FA QR Code" className="rounded-lg border" />{' '}
                </div>
              )}{' '}
              <div className="space-y-2">
                {' '}
                <Label htmlFor="twoFactorToken">Enter the 6-digit code from your app</Label>{' '}
                <Input
                  id="twoFactorToken"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value)}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />{' '}
              </div>{' '}
              {twoFactorError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {twoFactorError}
                </div>
              )}{' '}
              <Button
                onClick={handleEnable2fa}
                disabled={twoFactorLoading || twoFactorToken.length !== 6}
              >
                {' '}
                {twoFactorLoading ? 'Verifying...' : 'Enable 2FA'}{' '}
              </Button>{' '}
            </div>
          )}{' '}
          {twoFactorStatus === 'verify' && (
            <div className="space-y-4">
              {' '}
              <div className="rounded-md bg-green-500/10 p-4 text-sm">
                {' '}
                <strong className="text-green-600">
                  Two-factor authentication is now enabled!
                </strong>{' '}
              </div>{' '}
              <div className="rounded-md bg-amber-500/10 p-4 border border-amber-500/20">
                {' '}
                <p className="text-sm font-medium mb-2">Save these recovery codes</p>{' '}
                <p className="text-xs text-muted-foreground mb-3">
                  {' '}
                  Each code can be used only once. Store them somewhere safe.{' '}
                </p>{' '}
                <div className="grid grid-cols-2 gap-2">
                  {' '}
                  {twoFactorBackupCodes.map((code, i) => (
                    <code key={i} className="bg-background px-2 py-1 rounded text-sm font-mono">
                      {code}
                    </code>
                  ))}{' '}
                </div>{' '}
              </div>{' '}
              <Button onClick={() => setTwoFactorStatus('idle')}>Done</Button>{' '}
            </div>
          )}{' '}
        </CardContent>{' '}
      </Card>{' '}
      <Card>
        {' '}
        <CardHeader>
          {' '}
          <CardTitle>Active Sessions</CardTitle>{' '}
          <CardDescription>Manage devices where you&apos;re logged in.</CardDescription>{' '}
        </CardHeader>{' '}
        <CardContent className="space-y-4">
          {' '}
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {' '}
              {sessions.map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  {' '}
                  <div className="space-y-1">
                    {' '}
                    <p className="text-sm font-medium">
                      {' '}
                      {session.deviceInfo || 'Unknown device'}{' '}
                      {session.isCurrent && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {' '}
                          Current{' '}
                        </span>
                      )}{' '}
                    </p>{' '}
                    <p className="text-xs text-muted-foreground">
                      {' '}
                      {session.ip && `${session.ip} \u00b7 `} Last active:{' '}
                      {new Date(session.lastActiveAt).toLocaleDateString()}{' '}
                    </p>{' '}
                  </div>{' '}
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      {' '}
                      Revoke{' '}
                    </Button>
                  )}{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
          <Separator />{' '}
          <div className="flex justify-between items-center">
            {' '}
            <div>
              {' '}
              <p className="text-sm font-medium">Logout everywhere</p>{' '}
              <p className="text-xs text-muted-foreground">Sign out of all active sessions</p>{' '}
            </div>{' '}
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (confirm('Log out of all devices?')) {
                  await logoutEverywhere();
                }
              }}
            >
              {' '}
              Logout All{' '}
            </Button>{' '}
          </div>{' '}
        </CardContent>{' '}
      </Card>{' '}
    </div>
  );
}
