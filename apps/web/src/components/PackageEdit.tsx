/**
 * PackageEdit 组件 - 编辑包信息
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePackage } from '../hooks/usePackages';
import { api } from '../lib/api';
import { Loader2, ArrowLeft, Save, CheckCircle, AlertCircle } from 'lucide-react';

export function PackageEdit() {
  const { t } = useTranslation('pages');
  const { scope, name } = useParams<{ scope: string; name: string }>();
  const navigate = useNavigate();

  const { data: pkg, isLoading, error } = usePackage(scope || '', name || '');

  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [license, setLicense] = useState('');
  const [repository, setRepository] = useState('');
  const [homepage, setHomepage] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // 初始化表单
  useEffect(() => {
    if (pkg) {
      setDescription(pkg.description || '');
      setTags(pkg.tags.join(', '));
      setVisibility(pkg.visibility);
      setLicense(pkg.license || '');
      setRepository(pkg.repository || '');
      setHomepage(pkg.homepage || '');
    }
  }, [pkg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scope || !name) return;

    setSaving(true);
    setStatus('idle');

    try {
      await api.updatePackage(scope, name, {
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
        license: license || undefined,
        repository: repository || undefined,
        homepage: homepage || undefined,
      });
      setStatus('success');
      setStatusMessage(t('packageEdit.success', 'Package updated successfully'));
      // 刷新包数据
      setTimeout(() => navigate(`/packages/${scope}/${name}`), 1500);
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : t('packageEdit.error', 'Failed to update package'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-mono">Loading...</p>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <AlertCircle className="w-6 h-6 text-destructive mb-3" />
        <p className="text-destructive">Package not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to={`/packages/${scope}/${name}`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          {pkg.full_name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Edit Package</h1>

      {/* 状态消息 */}
      {status === 'success' && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}
      {status === 'error' && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 描述 */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            placeholder="Package description..."
          />
        </div>

        {/* 标签 */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-2">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            placeholder="ai, tool, mcp"
          />
          <p className="text-xs text-muted-foreground mt-1">Comma-separated tags</p>
        </div>

        {/* 可见性 */}
        <div>
          <label htmlFor="visibility" className="block text-sm font-medium mb-2">
            Visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="team">Team</option>
          </select>
        </div>

        {/* 许可证 */}
        <div>
          <label htmlFor="license" className="block text-sm font-medium mb-2">
            License
          </label>
          <input
            id="license"
            type="text"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            placeholder="MIT, Apache-2.0, etc."
          />
        </div>

        {/* 仓库地址 */}
        <div>
          <label htmlFor="repository" className="block text-sm font-medium mb-2">
            Repository URL
          </label>
          <input
            id="repository"
            type="url"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            placeholder="https://github.com/user/repo"
          />
        </div>

        {/* 主页 */}
        <div>
          <label htmlFor="homepage" className="block text-sm font-medium mb-2">
            Homepage URL
          </label>
          <input
            id="homepage"
            type="url"
            value={homepage}
            onChange={(e) => setHomepage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            placeholder="https://example.com"
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

export default PackageEdit;
