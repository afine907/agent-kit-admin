/**
 * 团队管理页面
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import {
  Users,
  Plus,
  Settings,
  UserPlus,
  UserMinus,
  Crown,
  Shield,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// 临时类型定义（后端 API 完成后替换）
interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export default function Teams() {
  const { t } = useTranslation('pages');
  const { user } = useAuthStore();
  const [teams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', slug: '', description: '' });

  if (!user) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('teams.loginRequired')}</p>
      </div>
    );
  }

  const handleCreateTeam = async () => {
    // TODO: 调用 API 创建团队
    setLoading(true);
    try {
      // await api.createTeam(newTeam);
      setShowCreateForm(false);
      setNewTeam({ name: '', slug: '', description: '' });
      // 重新加载团队列表
    } catch (err) {
      console.error('Failed to create team:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      owner: t('teams.roles.owner'),
      admin: t('teams.roles.admin'),
      member: t('teams.roles.member'),
    };
    return roles[role] || role;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{t('teams.title')}</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          {t('teams.createBtn')}
        </button>
      </div>

      {/* 创建团队表单 */}
      {showCreateForm && (
        <div className="mb-8 p-6 bg-card rounded-xl border border-border">
          <h2 className="text-xl font-semibold mb-4">{t('teams.createTitle')}</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('teams.name')} *
              </label>
              <input
                type="text"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder={t('teams.namePlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('teams.slug')} *
              </label>
              <input
                type="text"
                value={newTeam.slug}
                onChange={(e) => setNewTeam({ ...newTeam, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder={t('teams.slugPlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('teams.description')}
              </label>
              <textarea
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder={t('teams.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateTeam}
                disabled={loading || !newTeam.name || !newTeam.slug}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t('teams.create')}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                {t('common:actions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 团队列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{t('teams.empty')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('teams.emptyHint')}</p>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="p-6 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{team.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">@{team.slug}</p>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {team.member_count}
                </div>
              </div>
              {team.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {team.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t('teams.createdAt')}: {new Date(team.created_at).toLocaleDateString()}
                </span>
                <Settings className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 团队详情侧边栏 */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[80vh] bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedTeam.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">@{selectedTeam.slug}</p>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">{t('teams.members')}</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
                  <UserPlus className="w-4 h-4" />
                  {t('teams.addMember')}
                </button>
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <User className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.display_name || member.username}
                          </span>
                          {getRoleIcon(member.role)}
                          <span className="text-xs text-muted-foreground">
                            {getRoleLabel(member.role)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          @{member.username}
                        </span>
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <button
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        title={t('teams.removeMember')}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
