import { render, screen } from '@testing-library/react';
import { HealthCheckBadge } from '../HealthCheckBadge';

describe('HealthCheckBadge', () => {
  it('renders healthy status', () => {
    render(
      <HealthCheckBadge
        overall="healthy"
        compliance={{ status: 'pass', detail: {} }}
        content={{ status: 'pass', detail: {} }}
        functional={{ status: 'pass', detail: {} }}
        freshness={{ status: 'pass', detail: {} }}
      />,
    );
    expect(screen.getByText('Skill 健康')).toBeInTheDocument();
  });

  it('renders degraded status', () => {
    render(
      <HealthCheckBadge
        overall="degraded"
        compliance={{ status: 'fail', detail: { errors: ['content 超 50KB'] } }}
        content={{ status: 'pass', detail: {} }}
        functional={{ status: 'pass', detail: {} }}
        freshness={{ status: 'warn', detail: {} }}
      />,
    );
    expect(screen.getByText('Skill 状态异常')).toBeInTheDocument();
  });

  it('renders pending status', () => {
    render(
      <HealthCheckBadge
        overall="pending"
        compliance={{ status: 'skip', detail: {} }}
        content={{ status: 'skip', detail: {} }}
        functional={{ status: 'skip', detail: {} }}
        freshness={{ status: 'skip', detail: {} }}
      />,
    );
    expect(screen.getByText('待检测')).toBeInTheDocument();
  });
});
