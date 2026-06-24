/**
 * Web 发布向导 - 多步骤表单
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api, Team } from '../lib/api';
import {
  Package,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  FileJson,
  Tag,
  Globe,
  Lock,
  Users,
} from 'lucide-react';

interface PublishFormData {
  // 步骤 1: 基本信息
  name: string;
  scope: string;
  type: 'mcp' | 'skill';
  description: string;
  license: string;
  repository: string;
  homepage: string;
  visibility: 'public' | 'private' | 'team';
  tags: string[];

  // 步骤 2: 版本信息
  version: string;
  tag: string;

  // 步骤 3: 文件上传
  file: File | null;
}

const INITIAL_FORM: PublishFormData = {
  name: '',
  scope: '',
  type: 'mcp',
  description: '',
  license: 'MIT',
  repository: '',
  homepage: '',
  visibility: 'public',
  tags: [],
  version: '0.1.0',
  tag: 'latest',
  file: null,
};

const STEPS = [
  { id: 1, title: '基本信息', icon: Package },
  { id: 2, title: '版本信息', icon: Tag },
  { id: 3, title: '上传文件', icon: Upload },
  { id: 4, title: '确认发布', icon: Check },
];

export default function Publish() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PublishFormData>(INITIAL_FORM);
  const [tagInput, setTagInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P3#21: 团队 scope 动态加载
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  useEffect(() => {
    // P3#21: 加载用户团队列表用于 scope 选择
    const loadTeams = async () => {
      setTeamsLoading(true);
      try {
        const userTeams = await api.listTeams();
        setTeams(userTeams || []);
      } catch {
        // 忽略错误，用户仍可用个人 scope
      } finally {
        setTeamsLoading(false);
      }
    };
    if (user) {
      loadTeams();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('publish.loginRequired')}</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          {t('common:nav.login')}
        </button>
      </div>
    );
  }

  const updateForm = (updates: Partial<PublishFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
      updateForm({ tags: [...form.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateForm({ tags: form.tags.filter((t) => t !== tag) });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateForm({ file });
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return !!form.name && !!form.scope && !!form.type;
      case 2:
        return !!form.version;
      case 3:
        return !!form.file;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
      setError(null);
    } else {
      setError(t('publish.validationError'));
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
    setError(null);
  };

  const handlePublish = async () => {
    if (!form.file) return;

    setPublishing(true);
    setError(null);

    try {
      // 1. 创建包（如果不存在）
      try {
        await api.createPackage({
          name: form.name,
          scope: form.scope,
          type: form.type,
          description: form.description || undefined,
          license: form.license || undefined,
          visibility: form.visibility,
          tags: form.tags,
        });
      } catch (err: unknown) {
        // 包可能已存在，忽略 409 错误
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr.response?.status === 409) {
            // 忽略冲突错误，继续上传版本
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      // 2. 构建 manifest（从表单数据生成）
      const manifest = {
        name: form.name,
        version: form.version,
        type: form.type,
        description: form.description || undefined,
        license: form.license || undefined,
        repository: form.repository || undefined,
        homepage: form.homepage || undefined,
      };

      // 3. 上传版本
      const formData = new FormData();
      formData.append('file', form.file);
      formData.append('version', form.version);
      formData.append('manifest', JSON.stringify(manifest));
      formData.append('tag', form.tag || 'latest');

      await api.publishVersion(form.scope, form.name, formData);

      // 3. 跳转到包详情页
      navigate(`/packages/${form.scope}/${form.name}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('publish.publishFailed'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">{t('publish.title')}</h1>

      {/* 步骤指示器 */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;

          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{s.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 步骤内容 */}
      <div className="bg-card rounded-xl border border-border p-6">
        {/* 步骤 1: 基本信息 */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('publish.step1.title')}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step1.scope')} *
                </label>
                <select
                  value={form.scope}
                  onChange={(e) => updateForm({ scope: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <option value="">{t('publish.step1.selectScope')}</option>
                  <option value={`@${user.username}`}>@{user.username}</option>
                  {teamsLoading ? (
                    <option value="" disabled>Loading teams...</option>
                  ) : (
                    teams.map((team) => {
                      const teamScope = `@${team.slug}`;
                      return (
                        <option key={team.id} value={teamScope}>
                          {teamScope} ({team.name})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step1.name')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder={t('publish.step1.namePlaceholder')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('publish.step1.type')} *
              </label>
              <div className="flex items-center gap-4">
                {[
                  { value: 'mcp', label: 'MCP Server', desc: t('publish.step1.mcpDesc') },
                  { value: 'skill', label: 'Agent Skill', desc: t('publish.step1.skillDesc') },
                ].map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex-1 p-4 border rounded-lg cursor-pointer transition-colors ${
                      form.type === value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      checked={form.type === value}
                      onChange={(e) => updateForm({ type: e.target.value as 'mcp' | 'skill' })}
                      className="sr-only"
                    />
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('publish.step1.description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder={t('publish.step1.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step1.license')}
                </label>
                <select
                  value={form.license}
                  onChange={(e) => updateForm({ license: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <option value="MIT">MIT</option>
                  <option value="Apache-2.0">Apache-2.0</option>
                  <option value="GPL-3.0">GPL-3.0</option>
                  <option value="BSD-3-Clause">BSD-3-Clause</option>
                  <option value="">无许可证</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step1.visibility')}
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { value: 'public', icon: Globe, label: t('publish.step1.public') },
                    { value: 'private', icon: Lock, label: t('publish.step1.private') },
                    { value: 'team', icon: Users, label: t('publish.step1.team') },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => updateForm({ visibility: value as 'public' | 'private' | 'team' })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        form.visibility === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('publish.step1.tags')}
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder={t('publish.step1.tagsPlaceholder')}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80"
                >
                  {t('publish.step1.addTag')}
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-secondary/50 text-muted-foreground rounded-md border border-border/30"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 步骤 2: 版本信息 */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('publish.step2.title')}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step2.version')} *
                </label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => updateForm({ version: e.target.value })}
                  placeholder="0.1.0"
                  pattern="^\d+\.\d+\.\d+$"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('publish.step2.versionHint')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('publish.step2.tag')}
                </label>
                <select
                  value={form.tag}
                  onChange={(e) => updateForm({ tag: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <option value="latest">latest</option>
                  <option value="beta">beta</option>
                  <option value="alpha">alpha</option>
                  <option value="rc">rc</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 步骤 3: 文件上传 */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('publish.step3.title')}</h2>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".tar.gz,.tgz"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="font-medium mb-2">
                  {form.file ? form.file.name : t('publish.step3.dropzone')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('publish.step3.fileHint')}
                </p>
              </label>
            </div>

            {form.file && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileJson className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-medium">{form.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(form.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-2">{t('publish.step3.requirements')}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('publish.step3.req1')}</li>
                <li>• {t('publish.step3.req2')}</li>
                <li>• {t('publish.step3.req3')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* 步骤 4: 确认发布 */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('publish.step4.title')}</h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t('publish.step4.packageInfo')}
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step1.name')}</span>
                    <span className="font-mono">{form.scope}/{form.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step1.type')}</span>
                    <span className="uppercase">{form.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step1.visibility')}</span>
                    <span>{form.visibility}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t('publish.step4.versionInfo')}
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step2.version')}</span>
                    <span className="font-mono">{form.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step2.tag')}</span>
                    <span className="font-mono">{form.tag}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('publish.step3.file')}</span>
                    <span className="font-mono text-sm">{form.file?.name}</span>
                  </div>
                </div>
              </div>
            </div>

            {form.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {t('publish.step1.description')}
                </h4>
                <p className="text-sm">{form.description}</p>
              </div>
            )}

            {form.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {t('publish.step1.tags')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-mono bg-secondary/50 text-muted-foreground rounded-md border border-border/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="flex items-center gap-2 px-6 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common:actions.back')}
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            {t('common:actions.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('publish.publishing')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {t('publish.publishBtn')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
