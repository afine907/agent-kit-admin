/**
 * 团队管理页面 - shadcn 风格
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { api, type Team, type TeamMember } from '../lib/api'
import TeamPackagesTab from '../components/TeamPackagesTab'
import {
  Users, Plus, Settings, UserPlus, UserMinus, Crown, Shield,
  AlertCircle, Loader2, Package, X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

type Tab = 'members' | 'packages'

const TEAM_EMOJI: Record<string, string> = {
  frontend: '🎨', backend: '⚙️', devops: '🚀', data: '📊', ml: '🤖',
  default: '👥',
}

function getTeamEmoji(slug: string) {
  return TEAM_EMOJI[slug.toLowerCase()] || TEAM_EMOJI.default
}

export default function Teams() {
  const { t } = useTranslation('pages')
  const { user } = useAuthStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', slug: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<Tab>('members')

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.listTeams()
      setTeams(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('teams.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadMembers = useCallback(async (teamId: string) => {
    try {
      const data = await api.listTeamMembers(teamId)
      setMembers(data)
    } catch (err: unknown) {
      console.error('Failed to load members:', err)
    }
  }, [])

  useEffect(() => {
    if (user) loadTeams()
  }, [user, loadTeams])

  useEffect(() => {
    if (selectedTeam) loadMembers(selectedTeam.id)
  }, [selectedTeam, loadMembers])

  if (!user) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('teams.loginRequired')}</p>
      </div>
    )
  }

  const handleCreateTeam = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.createTeam(newTeam)
      setShowCreateForm(false)
      setNewTeam({ name: '', slug: '', description: '' })
      await loadTeams()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('teams.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      await api.removeTeamMember(teamId, userId)
      await loadMembers(teamId)
    } catch (err: unknown) {
      console.error('Failed to remove member:', err)
    }
  }

  const canManageTeam = members.some(
    (m) => m.user_id === user?.id && (m.role === 'owner' || m.role === 'admin')
  )

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3.5 h-3.5 text-amber-500" />
      case 'admin': return <Shield className="w-3.5 h-3.5 text-blue-500" />
      default: return null
    }
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      owner: t('teams.roles.owner'),
      admin: t('teams.roles.admin'),
      member: t('teams.roles.member'),
    }
    return roles[role] || role
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('teams.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {teams.length > 0 ? `${teams.length} 个团队` : '管理你的团队和私有包'}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('teams.createBtn')}
        </Button>
      </div>

      {/* 错误 */}
      {error && (
        <Card className="p-4 mb-6 border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {/* 创建表单 */}
      {showCreateForm && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t('teams.createTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('teams.name')} *</Label>
              <Input
                value={newTeam.name}
                onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder={t('teams.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('teams.slug')} *</Label>
              <Input
                value={newTeam.slug}
                onChange={e => setNewTeam({ ...newTeam, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder={t('teams.slugPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('teams.description')}</Label>
              <Input
                value={newTeam.description}
                onChange={e => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder={t('teams.descriptionPlaceholder')}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleCreateTeam} disabled={loading || !newTeam.name || !newTeam.slug} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('teams.create')}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              {t('common:actions.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* 加载 */}
      {loading && teams.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('common:loading')}</p>
        </div>
      ) : teams.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 border-dashed">
          <div className="text-6xl mb-4">{TEAM_EMOJI.default}</div>
          <p className="text-muted-foreground mb-1">{t('teams.empty')}</p>
          <p className="text-sm text-muted-foreground/60 mb-4">{t('teams.emptyHint')}</p>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('teams.createBtn')}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="p-5 cursor-pointer hover:border-primary/40 transition-all hover:shadow-md hover:shadow-primary/5"
              onClick={() => { setSelectedTeam(team); setSelectedTab('members') }}
            >
              <div className="flex items-start gap-4">
                {/* Emoji avatar */}
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted text-2xl shrink-0">
                  {getTeamEmoji(team.slug)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{team.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">@{team.slug}</p>
                </div>
              </div>

              {team.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{team.description}</p>
              )}

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{team.member_count} 成员</span>
                </div>
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 团队详情弹窗 */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTeam(null)} />
          {/* Modal */}
          <div className="relative z-50 w-full max-w-2xl max-h-[85vh] bg-card rounded-2xl border shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted text-xl">
                  {getTeamEmoji(selectedTeam.slug)}
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{selectedTeam.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">@{selectedTeam.slug}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b bg-muted/30">
              <Tabs value={selectedTab} onValueChange={v => setSelectedTab(v as Tab)}>
                <TabsList className="h-12 bg-transparent">
                  <TabsTrigger value="members" className="data-[state=active]:bg-card">
                    <Users className="w-4 h-4 mr-2" />
                    {t('teams.members')}
                  </TabsTrigger>
                  <TabsTrigger value="packages" className="data-[state=active]:bg-card">
                    <Package className="w-4 h-4 mr-2" />
                    {t('teams.packages.title')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedTab === 'members' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm text-muted-foreground">{t('teams.members')}</h3>
                    {canManageTeam && (
                      <Button size="sm" variant="outline" className="gap-1.5 h-8">
                        <UserPlus className="w-3.5 h-3.5" />
                        {t('teams.addMember')}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {(member.display_name || member.username).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{member.display_name || member.username}</span>
                              {getRoleIcon(member.role)}
                              <span className="text-xs text-muted-foreground">{getRoleLabel(member.role)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">@{member.username}</span>
                          </div>
                        </div>
                        {member.role !== 'owner' && canManageTeam && (
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveMember(selectedTeam.id, member.user_id)}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <TeamPackagesTab teamId={selectedTeam.id} canManage={canManageTeam} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
