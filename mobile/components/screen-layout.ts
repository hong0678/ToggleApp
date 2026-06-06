import type { EdgeInsets } from 'react-native-safe-area-context';

export const SCREEN_HORIZONTAL_PADDING = 18;
export const SCREEN_TOP_PADDING = 24;
export const SCREEN_BOTTOM_PADDING = 26;
export const HOME_TOP_PADDING = 4;
export const HOME_BOTTOM_PADDING = 110;
export const TAB_SCREEN_BOTTOM_PADDING = 92;
export const BOTTOM_TAB_BAR_HEIGHT = 38;

type ScreenContentOptions = {
  horizontalPadding?: number;
  topPadding?: number;
  bottomPadding?: number;
  extraBottomPadding?: number;
};

export const getScreenContentStyle = (insets: EdgeInsets, options: ScreenContentOptions = {}) => ({
  paddingHorizontal: options.horizontalPadding ?? SCREEN_HORIZONTAL_PADDING,
  paddingTop: insets.top + (options.topPadding ?? SCREEN_TOP_PADDING),
  paddingBottom:
    insets.bottom + (options.bottomPadding ?? SCREEN_BOTTOM_PADDING) + (options.extraBottomPadding ?? 0),
});

export const getStandardScreenContentStyle = (insets: EdgeInsets) =>
  getScreenContentStyle(insets);

export const getHomeScreenContentStyle = (insets: EdgeInsets) =>
  getScreenContentStyle(insets, {
    topPadding: HOME_TOP_PADDING,
    bottomPadding: HOME_BOTTOM_PADDING,
  });

export const getTabScreenContentStyle = (insets: EdgeInsets) =>
  getScreenContentStyle(insets, {
    bottomPadding: SCREEN_BOTTOM_PADDING,
    extraBottomPadding: TAB_SCREEN_BOTTOM_PADDING,
  });

export const getBottomTabBarStyle = (insets: EdgeInsets) => ({
  height: BOTTOM_TAB_BAR_HEIGHT,
  paddingTop: 0,
  paddingBottom: 0,
});
