'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { Reveal } from '@/components/ui/motion';
import { SettingsBanner } from '../../settings/_components/settings-ui';
export default function SecuritySettingsPage() {
  const t = useTranslations('account');
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
  // The skeleton draws as many session rows as this list last showed.
  useEffect(() => {
    if (!sessionsLoading) rememberListCount('public-account-sessions', sessions.length);
  }, [sessionsLoading, sessions.length]);
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
      setPwError(t('security.pwMismatch'));
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess(t('security.pwChanged'));
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('security.pwChangeFailed'));
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
      setEmailSuccess(t('security.emailVerificationSent'));
      setEmailForm({ newEmail: '', password: '' });
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t('security.emailChangeFailed'));
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
      setTwoFactorError(t('security.twoFactorSetupFailed'));
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
      setTwoFactorError(err instanceof Error ? err.message : t('security.twoFactorEnableFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  };
  const handleDisable2fa = async () => {
    if (!confirm(t('security.disableConfirm'))) return;
    setTwoFactorLoading(true);
    try {
      const token = prompt(t('security.disablePrompt'));
      if (!token) return;
      await disable2fa(token);
      setTwoFactorStatus('idle');
    } catch (err) {
      alert(err instanceof Error ? err.message : t('security.twoFactorDisableFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  };
  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      loadSessions();
    } catch {
      alert(t('security.revokeFailed'));
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 md:py-16">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-[-0.022em] text-foreground">
          {t('security.pageTitle')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('security.pageSubtitle')}</p>
      </div>
      {user?.twoFactorEnabled && (
        <div className="rounded-xl border border-success/25 bg-success/10 p-4 text-sm text-success">
          <strong>{t('security.twoFactorEnabledBanner')}</strong>
          {t('security.twoFactorActiveHint')}
        </div>
      )}
      <Reveal>
        <Card className="rounded-xl border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium tracking-[-0.012em]">
              {t('security.changePassword')}
            </CardTitle>
            <CardDescription>{t('security.changePasswordDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <SettingsBanner show={!!pwError} tone="error" role="alert" className="py-2.5">
                {pwError}
              </SettingsBanner>
              <SettingsBanner show={!!pwSuccess} tone="success" role="status" className="py-2.5">
                {pwSuccess}
              </SettingsBanner>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('security.currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('security.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('security.confirmNewPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={pwLoading}>
                {pwLoading ? t('security.changing') : t('security.changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Reveal>
      <Reveal>
        <Card className="rounded-xl border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium tracking-[-0.012em]">
              {t('security.changeEmail')}
            </CardTitle>
            <CardDescription>{t('security.changeEmailDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangeEmail} className="space-y-4">
              <SettingsBanner show={!!emailError} tone="error" role="alert" className="py-2.5">
                {emailError}
              </SettingsBanner>
              <SettingsBanner show={!!emailSuccess} tone="success" role="status" className="py-2.5">
                {emailSuccess}
              </SettingsBanner>
              <div className="space-y-2">
                <Label htmlFor="newEmail">{t('security.newEmail')}</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailPassword">{t('security.currentPassword')}</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={emailLoading}>
                {emailLoading ? t('security.sending') : t('security.sendVerification')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Reveal>
      <Reveal>
        <Card className="rounded-xl border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium tracking-[-0.012em]">
              {t('security.twoFactorTitle')}
            </CardTitle>
            <CardDescription>{t('security.twoFactorDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {twoFactorStatus === 'idle' && !user?.twoFactorEnabled && (
              <Button onClick={handleSetup2fa} disabled={twoFactorLoading}>
                {t('security.enableTwoFactor')}
              </Button>
            )}
            {twoFactorStatus === 'idle' && user?.twoFactorEnabled && (
              <Button variant="destructive" onClick={handleDisable2fa} disabled={twoFactorLoading}>
                {t('security.disableTwoFactor')}
              </Button>
            )}
            {twoFactorStatus === 'setup' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('security.scanQrHint')}</p>
                {twoFactorQr && (
                  <div className="flex justify-center">
                    <img
                      src={twoFactorQr}
                      alt={t('security.qrAlt')}
                      className="rounded-xl border border-border/70 bg-card p-3 shadow-xs"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="twoFactorToken">{t('security.enterCodeFromApp')}</Label>
                  <Input
                    id="twoFactorToken"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value)}
                    maxLength={6}
                    className="h-12 text-center font-mono text-2xl tracking-[0.3em]"
                  />
                </div>
                <SettingsBanner
                  show={!!twoFactorError}
                  tone="error"
                  role="alert"
                  className="py-2.5"
                >
                  {twoFactorError}
                </SettingsBanner>
                <Button
                  onClick={handleEnable2fa}
                  disabled={twoFactorLoading || twoFactorToken.length !== 6}
                >
                  {twoFactorLoading ? t('security.verifying') : t('security.enable2faShort')}
                </Button>
              </div>
            )}
            {twoFactorStatus === 'verify' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-success/25 bg-success/10 p-4 text-sm">
                  <strong className="font-medium text-success">
                    {t('security.twoFactorEnabledToast')}
                  </strong>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-sm font-medium mb-2">{t('security.saveRecoveryCodes')}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('security.recoveryCodesHint')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {twoFactorBackupCodes.map((code, i) => (
                      <code
                        key={i}
                        className="rounded-lg border border-border/70 bg-card px-2.5 py-1.5 font-mono text-sm"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
                <Button onClick={() => setTwoFactorStatus('idle')}>{t('security.done')}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Reveal>
      <Reveal>
        <Card className="rounded-xl border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium tracking-[-0.012em]">
              {t('security.activeSessions')}
            </CardTitle>
            <CardDescription>{t('security.activeSessionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground">{t('security.loadingSessions')}</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('security.noSessions')}</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 transition-colors hover:border-border-strong"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {session.deviceInfo || t('unknownDevice')}
                        {session.isCurrent && (
                          <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {t('currentBadge')}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.ip && `${session.ip} \u00b7 `} {t('lastActive')}
                        {new Date(session.lastActiveAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        {t('security.revoke')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('security.logoutEverywhere')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('security.logoutEverywhereDescActive')}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (confirm(t('security.logoutAllConfirm'))) {
                    await logoutEverywhere();
                  }
                }}
              >
                {t('security.logoutAll')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
