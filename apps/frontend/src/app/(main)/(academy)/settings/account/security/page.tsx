'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ReauthModal } from '@/components/auth/reauth-modal';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { toast } from '@/components/ui/toast';
import {
  Shield,
  KeyRound,
  Mail,
  Smartphone,
  Monitor,
  Laptop,
  History,
  Check,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
export default function SecuritySettingsPage() {
  const tSecurity = useTranslations('account');
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
  const [showPw, setShowPw] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthAction, setReauthAction] = useState<'email' | 'disable2fa' | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [twoFactorStatus, setTwoFactorStatus] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorQr, setTwoFactorQr] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'password' | 'sessions' | 'history'>('password');
  useEffect(() => {
    loadSessions();
    loadLoginHistory();
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
  const loadLoginHistory = async () => {
    setLoginHistoryLoading(true);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/login-history');
      if (res.ok) setLoginHistory(await res.json());
    } catch {
    } finally {
      setLoginHistoryLoading(false);
    }
  };
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(tSecurity('security.pwMismatch'));
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess(tSecurity('security.pwChangedShort'));
      toast({ type: 'ok', title: tSecurity('security.pwChangedShort') });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : tSecurity('security.pwChangeFailed');
      setPwError(message);
      toast({ type: 'err', title: tSecurity('security.pwChangeFailed'), description: message });
    } finally {
      setPwLoading(false);
    }
  };
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    if (!emailForm.newEmail) {
      setEmailError(tSecurity('security.newEmailRequired'));
      return;
    }
    setReauthAction('email');
    setReauthOpen(true);
  };
  const executeEmailChange = async (verifiedPassword: string) => {
    setEmailLoading(true);
    try {
      // Must forward the password the reauth modal already verified. Sending ''
      // made every email change fail with 400 "Password is incorrect".
      await changeEmail(emailForm.newEmail, verifiedPassword);
      setEmailSuccess(tSecurity('security.emailVerificationSentShort'));
      toast({ type: 'ok', title: tSecurity('security.emailVerificationSentShort') });
      setEmailForm({ newEmail: '', password: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : tSecurity('account.unknownError');
      setEmailError(message);
      toast({ type: 'err', title: tSecurity('security.emailChangeFailed'), description: message });
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
      setTwoFactorError(tSecurity('security.twoFactorSetupFailed'));
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
      toast({ type: 'ok', title: tSecurity('security.twoFactorEnabledToast') });
    } catch (err) {
      const message = err instanceof Error ? err.message : tSecurity('security.twoFactorEnableFailed');
      setTwoFactorError(message);
      toast({ type: 'err', title: tSecurity('security.twoFactorEnableFailed'), description: message });
    } finally {
      setTwoFactorLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <Shield className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">{tSecurity('security.pageTitleSimple')}</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {tSecurity('security.pageSubtitleAdvanced')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {user?.twoFactorEnabled && (
        <div className="flex gap-3 rounded-2xl border border-success bg-success px-4 py-3 dark:border-success/30 dark:bg-success/10">
          {' '}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="size-4" />
          </div>{' '}
          <div>
            {' '}
            <p className="text-sm font-semibold text-success dark:text-success">
              {tSecurity('security.twoFactorActive')}
            </p>{' '}
            <p className="text-xs leading-relaxed text-success/80 dark:text-success">
              {tSecurity('security.twoFactorActiveHint')}
            </p>{' '}
          </div>{' '}
        </div>
      )}{' '}
      {/* Tabs */}{' '}
      <div className="flex gap-1 rounded-full bg-muted p-1 w-fit">
        {' '}
        {(
          [
            ['password', tSecurity('security.tabPasswordEmail')],
            ['sessions', tSecurity('security.tabSessions')],
            ['history', tSecurity('security.tabHistory')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${activeTab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {' '}
            {label}{' '}
          </button>
        ))}{' '}
      </div>{' '}
      {activeTab === 'password' && (
        <div className="space-y-6">
          {' '}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
              {' '}
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                  <KeyRound className="size-3.5" />
                </span>{' '}
                {tSecurity('security.changePassword')}
              </h2>{' '}
              <p className="mt-1 text-xs text-muted-foreground">
                {tSecurity('security.changePasswordDescAfter')}
              </p>{' '}
            </div>{' '}
            <div className="p-6">
              {' '}
              <form onSubmit={handleChangePassword} className="space-y-4">
                {' '}
                {pwError && (
                  <div className="rounded-xl border border-destructive bg-destructive/10 px-4 py-2.5 text-sm text-destructive dark:border-red-900/30 dark:bg-destructive/10 dark:text-red-300">
                    {pwError}
                  </div>
                )}{' '}
                {pwSuccess && (
                  <div className="rounded-xl border border-success bg-success/10 px-4 py-2.5 text-sm text-success dark:border-success/30 dark:bg-success/10 dark:text-success">
                    {pwSuccess}
                  </div>
                )}{' '}
                <div className="space-y-2">
                  {' '}
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {tSecurity('security.currentPassword')}
                  </label>{' '}
                  <div className="relative">
                    {' '}
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      required
                      className="h-10 rounded-xl bg-muted/20 pe-10"
                    />{' '}
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>{' '}
                  </div>{' '}
                </div>{' '}
                <div className="grid gap-4 sm:grid-cols-2">
                  {' '}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tSecurity('security.newPassword')}
                    </label>
                    <Input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      required
                      className="h-10 rounded-xl bg-muted/20"
                    />
                  </div>{' '}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tSecurity('security.confirm')}
                    </label>
                    <Input
                      type="password"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      required
                      className="h-10 rounded-xl bg-muted/20"
                    />
                  </div>{' '}
                </div>{' '}
                <Button type="submit" disabled={pwLoading} className="h-9 rounded-full px-5">
                  {pwLoading ? tSecurity('security.changing') : tSecurity('security.changePassword')}
                </Button>{' '}
              </form>{' '}
            </div>{' '}
          </div>{' '}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
              {' '}
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                  <Mail className="size-3.5" />
                </span>{' '}
                {tSecurity('security.changeEmail')}
              </h2>{' '}
              <p className="mt-1 text-xs text-muted-foreground">
                {tSecurity('security.changeEmailDescVerify')}
              </p>{' '}
            </div>{' '}
            <div className="p-6">
              {' '}
              <form onSubmit={handleChangeEmail} className="space-y-4">
                {' '}
                {emailError && (
                  <div className="rounded-xl border border-destructive bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                    {emailError}
                  </div>
                )}{' '}
                {emailSuccess && (
                  <div className="rounded-xl border border-success bg-success/10 px-4 py-2.5 text-sm text-success">
                    {emailSuccess}
                  </div>
                )}{' '}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {tSecurity('security.newEmail')}
                  </label>
                  <Input
                    type="email"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    required
                    className="h-10 rounded-xl bg-muted/20"
                    placeholder="new@example.com"
                  />
                </div>{' '}
                <Button type="submit" disabled={emailLoading} className="h-9 rounded-full px-5">
                  {emailLoading ? tSecurity('security.sending') : tSecurity('security.sendVerification')}
                </Button>{' '}
              </form>{' '}
            </div>{' '}
          </div>{' '}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {' '}
            <div className="border-b border-border/60 bg-muted/20 px-6 py-4 flex items-center justify-between">
              {' '}
              <div>
                {' '}
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                    <Smartphone className="size-3.5" />
                  </span>{' '}
                  {tSecurity('security.twoFactorTitle')}
                </h2>{' '}
                <p className="mt-1 text-xs text-muted-foreground">
                  {tSecurity('security.twoFactorDescShort')}
                </p>{' '}
              </div>{' '}
              {user?.twoFactorEnabled && (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-success">
                  {tSecurity('security.twoFactorEnabledBadge')}
                </span>
              )}{' '}
            </div>{' '}
            <div className="p-6 space-y-4">
              {' '}
              {twoFactorStatus === 'idle' && !user?.twoFactorEnabled && (
                <Button
                  onClick={handleSetup2fa}
                  disabled={twoFactorLoading}
                  className="rounded-full"
                >
                  {tSecurity('security.enableTwoFactor')}
                </Button>
              )}{' '}
              {twoFactorStatus === 'idle' && user?.twoFactorEnabled && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setReauthAction('disable2fa');
                    setReauthOpen(true);
                  }}
                  className="rounded-full border-destructive text-destructive hover:bg-destructive/10"
                >
                  {tSecurity('security.disableTwoFactor')}
                </Button>
              )}{' '}
              {twoFactorStatus === 'setup' && (
                <div className="space-y-4">
                  {' '}
                  <p className="text-sm text-muted-foreground">{tSecurity('security.scanQrHintShort')}</p>{' '}
                  {twoFactorQr && (
                    <div className="flex justify-center rounded-2xl border bg-card p-4">
                      <img src={twoFactorQr} alt={tSecurity('security.qrAlt')} className="rounded-xl" />
                    </div>
                  )}{' '}
                  <div className="space-y-2">
                    {' '}
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tSecurity('security.enterCode')}
                    </label>{' '}
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={twoFactorToken}
                      onChange={(e) => setTwoFactorToken(e.target.value)}
                      maxLength={6}
                      className="h-12 rounded-xl bg-muted/20 text-center text-xl tracking-[0.3em] font-mono"
                    />{' '}
                  </div>{' '}
                  {twoFactorError && (
                    <div className="rounded-xl border border-destructive bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                      {twoFactorError}
                    </div>
                  )}{' '}
                  <Button
                    onClick={handleEnable2fa}
                    disabled={twoFactorLoading || twoFactorToken.length !== 6}
                    className="rounded-full px-6"
                  >
                    {tSecurity('security.enable2faShort')}
                  </Button>{' '}
                </div>
              )}{' '}
              {twoFactorStatus === 'verify' && (
                <div className="space-y-4">
                  {' '}
                  <div className="rounded-xl border border-success bg-success/10 px-4 py-3 text-sm text-success">
                    {tSecurity('security.twoFactorEnabledToast')}
                  </div>{' '}
                  <div className="rounded-2xl border border-warning/30 bg-warning p-4">
                    {' '}
                    <p className="text-sm font-semibold">{tSecurity('security.saveRecoveryCodes')}</p>{' '}
                    <p className="text-xs text-muted-foreground mb-3">
                      {tSecurity('security.recoveryCodesHintShort')}
                    </p>{' '}
                    <div className="grid grid-cols-2 gap-2">
                      {twoFactorBackupCodes.map((code, i) => (
                        <code
                          key={i}
                          className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm font-mono"
                        >
                          {code}
                          <button
                            onClick={() => navigator.clipboard.writeText(code)}
                            className="ms-2 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </code>
                      ))}
                    </div>{' '}
                  </div>{' '}
                  <Button onClick={() => setTwoFactorStatus('idle')} className="rounded-full">
                    {tSecurity('security.done')}
                  </Button>{' '}
                </div>
              )}{' '}
            </div>{' '}
          </div>{' '}
        </div>
      )}{' '}
      {activeTab === 'sessions' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {' '}
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            {' '}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                <Monitor className="size-3.5" />
              </span>{' '}
              {tSecurity('security.activeSessions')}
            </h2>{' '}
            <p className="mt-1 text-xs text-muted-foreground">
              {tSecurity('security.activeSessionsDesc')}
            </p>{' '}
          </div>{' '}
          <div className="p-6 space-y-4">
            {' '}
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground">{tSecurity('security.loadingSessions')}</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tSecurity('security.noSessionsShort')}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="group flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-primary/20 hover:bg-primary/[0.02] hover:shadow-sm"
                  >
                    {' '}
                    <div className="flex gap-3">
                      {' '}
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition">
                        {' '}
                        <Laptop className="size-4" />{' '}
                      </div>{' '}
                      <div>
                        {' '}
                        <p className="text-sm font-medium flex items-center gap-2">
                          {session.deviceInfo || tSecurity('account.unknownDevice')}
                          {session.isCurrent && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-primary-foreground">
                              {tSecurity('account.currentBadge')}
                            </span>
                          )}
                        </p>{' '}
                        <p className="text-xs text-muted-foreground">
                          {session.ip && `${session.ip} · `}
                          {tSecurity('account.lastActive')}{' '}
                          {new Date(session.lastActiveAt).toLocaleDateString()}
                        </p>{' '}
                      </div>{' '}
                    </div>{' '}
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await revokeSession(session.id);
                            await loadSessions();
                            toast({ type: 'ok', title: tSecurity('security.sessionRevokedToast') });
                          } catch (err) {
                            toast({
                              type: 'err',
                              title: tSecurity('security.revokeFailed'),
                              description: err instanceof Error ? err.message : undefined,
                            });
                          }
                        }}
                        className="rounded-full"
                      >
                        {tSecurity('security.revoke')}
                      </Button>
                    )}{' '}
                  </div>
                ))}
              </div>
            )}{' '}
            <div className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning px-4 py-3 /30 dark:bg-warning/10">
              {' '}
              <div>
                <p className="text-sm font-semibold">{tSecurity('security.logoutEverywhere')}</p>
                <p className="text-xs text-muted-foreground">
                  {tSecurity('security.logoutEverywhereDesc')}
                </p>
              </div>{' '}
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (confirm(tSecurity('security.logoutAllConfirm'))) {
                    await logoutEverywhere();
                    toast({ type: 'ok', title: tSecurity('security.loggedOutEverywhereToast') });
                  }
                }}
                className="rounded-full"
              >
                {tSecurity('security.logoutAll')}
              </Button>{' '}
            </div>{' '}
          </div>{' '}
        </div>
      )}{' '}
      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {' '}
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            {' '}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                <History className="size-3.5" />
              </span>{' '}
              {tSecurity('security.loginHistoryTitle')}
            </h2>{' '}
            <p className="mt-1 text-xs text-muted-foreground">
              {tSecurity('security.loginHistoryDesc')}
            </p>{' '}
          </div>{' '}
          <div className="p-6">
            {' '}
            {loginHistoryLoading ? (
              <p className="text-sm text-muted-foreground">{tSecurity('account.loading')}</p>
            ) : loginHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tSecurity('security.noLoginHistory')}</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-auto pe-2">
                {loginHistory.slice(0, 15).map((entry: any) => {
                  const ua = entry.details?.userAgent || entry.userAgent || '';
                  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
                  const isMac = /Mac|Intel|Mac OS/i.test(ua) && !/iPhone|iPad/i.test(ua);
                  const isWin = /Windows|Win64|Win32/i.test(ua);
                  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/\S+/);
                  const browser = browserMatch ? browserMatch[1] : '';
                  const isFailed =
                    entry.details?.reason === 'invalid_password' ||
                    entry.action === 'user.login.failed';
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3"
                    >
                      {' '}
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${isFailed ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
                      >
                        {' '}
                        {isMobile ? (
                          <Smartphone className="size-4" />
                        ) : isMac ? (
                          <Laptop className="size-4" />
                        ) : isWin ? (
                          <Monitor className="size-4" />
                        ) : (
                          <Monitor className="size-4" />
                        )}{' '}
                      </div>{' '}
                      <div className="min-w-0 flex-1">
                        {' '}
                        <p className="text-sm font-medium">
                          {' '}
                          {isFailed
                            ? tSecurity('security.loginFailedAttempt')
                            : tSecurity('security.loginSuccessAttempt')}{' '}
                          {browser && (
                            <span className="ms-1 text-xs text-muted-foreground">· {browser}</span>
                          )}{' '}
                        </p>{' '}
                        <p className="text-xs text-muted-foreground truncate">
                          {' '}
                          {entry.ip && `${entry.ip}`} {!entry.ip && tSecurity('security.unknownIp')} ·{' '}
                          {new Date(entry.createdAt).toLocaleString()}{' '}
                        </p>{' '}
                      </div>{' '}
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wider ${isFailed ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
                      >
                        {' '}
                        {isFailed
                          ? tSecurity('security.loginFailedBadge')
                          : tSecurity('security.loginSuccessBadge')}{' '}
                      </span>{' '}
                    </div>
                  );
                })}
              </div>
            )}{' '}
          </div>{' '}
        </div>
      )}{' '}
      <ReauthModal
        open={reauthOpen}
        onOpenChange={(open) => {
          setReauthOpen(open);
          if (!open) setReauthAction(null);
        }}
        onVerified={(verifiedPassword) => {
          if (reauthAction === 'email') executeEmailChange(verifiedPassword);
          else if (reauthAction === 'disable2fa') {
            const t = disableToken;
            if (t) {
              setTwoFactorLoading(true);
              disable2fa(t)
                .then(() => {
                  setTwoFactorStatus('idle');
                  toast({ type: 'ok', title: tSecurity('security.twoFactorDisabledToast') });
                })
                .catch((e) => {
                  const message = e instanceof Error ? e.message : tSecurity('account.unknownError');
                  toast({ type: 'err', title: tSecurity('security.twoFactorDisableFailed'), description: message });
                })
                .finally(() => setTwoFactorLoading(false));
            }
          }
          setReauthAction(null);
        }}
        title={
          reauthAction === 'email'
            ? tSecurity('security.changeEmail')
            : reauthAction === 'disable2fa'
              ? tSecurity('security.disable2faShort')
              : tSecurity('security.verifyIdentity')
        }
        description={tSecurity('security.verifyPasswordDesc')}
      />{' '}
      {/* Disable 2FA inline dialog */}{' '}
      {reauthAction === 'disable2fa' && !reauthOpen && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {' '}
          <h3 className="text-sm font-semibold">{tSecurity('security.disableTwoFactorShort')}</h3>{' '}
          <p className="mt-1 text-xs text-muted-foreground">
            {tSecurity('security.confirmCodeDesc')}
          </p>{' '}
          <div className="mt-4 flex gap-3">
            {' '}
            <Input
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value)}
              placeholder="000000"
              className="h-10 flex-1 rounded-xl bg-muted/20 text-center font-mono tracking-widest"
              maxLength={6}
            />{' '}
            <Button
              onClick={() => {
                if (!disableToken) return;
                setReauthOpen(true);
              }}
              className="rounded-full"
            >
              {tSecurity('security.verify')}
            </Button>{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
