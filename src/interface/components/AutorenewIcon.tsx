import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from './colors';

/**
 * 循环刷新图标（Material "autorenew" 24x24 path）。
 * 项目未引入图标库，用已依赖的 react-native-svg 绘制。
 */
export function AutorenewIcon({
  size = 20,
  color = colors.statusIdeas,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
    </Svg>
  );
}
