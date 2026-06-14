/**
 * 企业微信 Logo SVG 组件
 * 来源: logo.wine (WeChat Logo) - 简化版
 */

interface WechatWorkIconProps {
  className?: string;
  size?: number;
}

export function WechatWorkIcon({ className, size = 24 }: WechatWorkIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="wechatGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#78D431" />
          <stop offset="100%" stopColor="#9EEE69" />
        </linearGradient>
      </defs>
      {/* 主气泡 */}
      <path
        fill="url(#wechatGrad1)"
        d="M120 40C75.8 40 40 71.4 40 110c0 22.4 13.2 42.4 33.6 55.6 1.8 1.2 2.8 3 2.8 5.4 0 .6-.3 1.6-.3 2.2-1.6 6.2-4.4 16.6-4.8 17-.3 1-.6 1.6-.6 2.6 0 1.8 1.6 3.4 3.4 3.4.6 0 1.2-.3 1.8-.6l22.4-12.8c1.6-.9 3.4-1.6 5.4-1.6.9 0 2.2 0 3.2.3 10.4 3.2 21.8 4.8 33.6 4.8 44.2 0 80-31.4 80-70S164.2 40 120 40z"
      />
      {/* 小气泡 */}
      <circle cx="90" cy="100" r="10" fill="#187E28" />
      <circle cx="150" cy="100" r="10" fill="#187E28" />
    </svg>
  );
}
