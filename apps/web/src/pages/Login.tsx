/**
 * Login 页面 - shadcn 风格，专业左右分栏
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { Boxes, ArrowRight, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'login' | 'register'

export default function Login() {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.login(email, password)
      setAuth(data.token, data.user, data.refresh_token)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.register(username, email, password, displayName || undefined)
      setAuth(data.token, data.user, data.refresh_token)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex">
      {/* 左侧品牌面板 */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-primary/10 via-background to-accent/5 overflow-hidden">
        {/* 装饰圆形 */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-primary/5 rounded-full blur-2xl" />
        {/* Dot grid */}
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
            <Boxes className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">Agent<span className="text-primary">Kit</span></span>
        </div>

        {/* 核心信息 */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight mb-3">
              AI 技能包管理<br />
              <span className="text-primary">高效、稳定、开放</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              私有化的 AI Agent Skill 注册中心，为团队提供安全、高效的技能包管理方案。
            </p>
          </div>

          {/* 特性列表 */}
          <div className="space-y-3">
            {[
              '私有化部署，数据自主可控',
              '语义化版本管理，发布不可篡改',
              '团队协作与权限管理',
              '自动化健康检测与质量评估',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 底部 */}
        <div className="relative flex items-center gap-2 text-xs text-muted-foreground/60">
          <Shield className="w-3 h-3" />
          <span>私有化部署 · 安全可控</span>
        </div>
      </div>

      {/* 右侧表单面板 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* 标题 */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? t('login.subtitle.login') : t('login.subtitle.register')}
            </h2>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={mode === 'login' ? handleLocalLogin : handleRegister} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t('login.username')}</Label>
                  <Input
                    id="username" type="text" autoComplete="username" spellCheck={false}
                    placeholder={t('login.usernamePlaceholder')} value={username}
                    onChange={e => setUsername(e.target.value)} required minLength={3}
                    maxLength={50} pattern="[a-zA-Z0-9_-]+"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">{t('login.displayName')}</Label>
                  <Input
                    id="displayName" type="text" autoComplete="name"
                    placeholder={t('login.displayNamePlaceholder')} value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email" type="email" autoComplete="email" spellCheck={false}
                placeholder={t('login.emailPlaceholder')} value={email}
                onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password" type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={t('login.passwordPlaceholder')} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? t('login.processing') : mode === 'login' ? t('login.loginBtn') : t('login.registerBtn')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          {/* 切换模式 */}
          <div className="text-center text-sm">
            {mode === 'login' ? (
              <span className="text-muted-foreground">
                {t('login.noAccount')}{' '}
                <button onClick={() => { setMode('register'); setError(null) }}
                  className="text-primary font-medium hover:underline">
                  {t('login.registerBtn')}
                </button>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t('login.hasAccount')}{' '}
                <button onClick={() => { setMode('login'); setError(null) }}
                  className="text-primary font-medium hover:underline">
                  {t('login.loginBtn')}
                </button>
              </span>
            )}
          </div>

          {/* 底部 */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <Shield className="w-3 h-3" />
            {t('login.footer')}
          </div>
        </div>
      </div>
    </div>
  )
}
