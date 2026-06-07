import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MiniKakaoMapPlace = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

type MiniKakaoMapPreviewProps = {
  places: MiniKakaoMapPlace[];
  center?: {
    latitude: number;
    longitude: number;
  } | null;
  height?: number;
  showCenterMarker?: boolean;
  lockToCenter?: boolean;
};

const KAKAO_MAP_APP_KEY = '2d21c1757f136b1ff4079ef80c900b15';
const MAP_BLUE = '#18a5a5';
const MAP_BACKGROUND = '#eef1f5';
const MAP_SURFACE = '#f9fafb';
const MAP_TEXT = '#191f28';
const MAP_TEXT_SUBTLE = '#6b7684';
const MARKER_COLORS = [MAP_BLUE, '#30b6b6', '#58c7c7', '#89d8d8'];

export function MiniKakaoMapPreview({
  places,
  center = null,
  height = 190,
  showCenterMarker = true,
  lockToCenter = false,
}: MiniKakaoMapPreviewProps) {
  const validPlaces = useMemo(
    () => places.filter((place) => typeof place.latitude === 'number' && typeof place.longitude === 'number'),
    [places]
  );
  const hasCenter = typeof center?.latitude === 'number' && typeof center?.longitude === 'number';
  const shouldShowCenterMarker = hasCenter && showCenterMarker;

  const html = useMemo(() => {
    const serializedPlaces = JSON.stringify(validPlaces.map((place) => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    })));
    const serializedCenter = JSON.stringify(hasCenter ? center : null);
    const serializedShowCenterMarker = JSON.stringify(shouldShowCenterMarker);
    const serializedLockToCenter = JSON.stringify(lockToCenter);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            html, body, #map {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: ${MAP_BACKGROUND};
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var places = ${serializedPlaces};
            var center = ${serializedCenter};
            var showCenterMarker = ${serializedShowCenterMarker};
            var lockToCenter = ${serializedLockToCenter};

            function createMarkerImage(index) {
              var colorPalette = ${JSON.stringify(MARKER_COLORS)};
              var color = colorPalette[index % colorPalette.length];
              var svg = [
                '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">',
                '<defs>',
                '<filter id="shadow" x="-20%" y="-10%" width="140%" height="140%">',
                '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#191f28" flood-opacity="0.12"/>',
                '</filter>',
                '</defs>',
                '<g filter="url(#shadow)">',
                '<path d="M18 46s12.5-14.8 12.5-24.8C30.5 11.7 24.9 6 18 6S5.5 11.7 5.5 21.2C5.5 31.2 18 46 18 46Z" fill="' + color + '"/>',
                '<circle cx="18" cy="20" r="8.6" fill="${MAP_SURFACE}"/>',
                '<circle cx="18" cy="20" r="4.8" fill="' + color + '"/>',
                '</g>',
                '</svg>',
              ].join('');

              return new kakao.maps.MarkerImage(
                'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                new kakao.maps.Size(36, 48),
                { offset: new kakao.maps.Point(18, 44) }
              );
            }

            function createCenterMarkerImage() {
              var svg = [
                '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">',
                '<circle cx="21" cy="21" r="19" fill="rgba(24,165,165,0.16)"/>',
                '<circle cx="21" cy="21" r="11" fill="${MAP_BLUE}"/>',
                '<circle cx="21" cy="21" r="5.5" fill="${MAP_SURFACE}"/>',
                '</svg>',
              ].join('');

              return new kakao.maps.MarkerImage(
                'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                new kakao.maps.Size(42, 42),
                { offset: new kakao.maps.Point(21, 21) }
              );
            }

            function initMap() {
              var centerPlace = center || places[0] || { latitude: 37.5665, longitude: 126.9780 };
              var map = new kakao.maps.Map(document.getElementById('map'), {
                center: new kakao.maps.LatLng(centerPlace.latitude, centerPlace.longitude),
                level: places.length > 1 ? 6 : 4,
                draggable: false,
                scrollwheel: false,
                disableDoubleClickZoom: true
              });

              map.setDraggable(false);
              map.setZoomable(false);

              var bounds = new kakao.maps.LatLngBounds();

              if (center && showCenterMarker) {
                var centerPosition = new kakao.maps.LatLng(center.latitude, center.longitude);
                bounds.extend(centerPosition);
                new kakao.maps.Marker({
                  map: map,
                  position: centerPosition,
                  title: '내 위치',
                  image: createCenterMarkerImage()
                });
              }

              if (!places.length && !center) return;

              places.forEach(function(place, index) {
                var position = new kakao.maps.LatLng(place.latitude, place.longitude);
                bounds.extend(position);
                new kakao.maps.Marker({
                  map: map,
                  position: position,
                  title: place.name,
                  image: createMarkerImage(index)
                });
              });

              function fitToAllPlaces() {
                if (lockToCenter && center) {
                  map.setCenter(new kakao.maps.LatLng(center.latitude, center.longitude));
                  map.setLevel(4);
                  return;
                }

                if (places.length > 1 || center) {
                  map.relayout();
                  map.setBounds(bounds, 56, 56, 56, 56);
                  return;
                }

                if (places.length === 1) {
                  map.setCenter(new kakao.maps.LatLng(places[0].latitude, places[0].longitude));
                }
              }

              if (lockToCenter && center) {
                fitToAllPlaces();
              } else if (places.length > 1 || center) {
                fitToAllPlaces();
              } else if (places.length === 1) {
                fitToAllPlaces();
              }

              setTimeout(function() {
                fitToAllPlaces();
              }, 60);
            }

            var script = document.createElement('script');
            script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_APP_KEY}&autoload=false";
            script.onload = function() {
              kakao.maps.load(initMap);
            };
            document.head.appendChild(script);
          </script>
        </body>
      </html>
    `;
  }, [center, hasCenter, lockToCenter, shouldShowCenterMarker, validPlaces]);

  if (validPlaces.length === 0 && !hasCenter) {
    return (
      <View style={[styles.emptyMap, { height }]}>
        <Text style={styles.emptyMapTitle}>지도에 표시할 좌표가 없어요</Text>
        <Text style={styles.emptyMapText}>장소 좌표가 있는 항목만 지도 preview에 표시됩니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        mixedContentMode="always"
        pointerEvents="none"
      />
      <View style={styles.countBadge} pointerEvents="none">
        <Text style={styles.countBadgeText}>
          {shouldShowCenterMarker ? '내 위치 + ' : ''}
          {validPlaces.length}개 장소
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: MAP_BACKGROUND,
  },
  webView: {
    flex: 1,
    backgroundColor: MAP_BACKGROUND,
  },
  countBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(249,250,251,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countBadgeText: {
    color: MAP_TEXT,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyMap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: MAP_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyMapTitle: {
    color: MAP_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyMapText: {
    marginTop: 6,
    color: MAP_TEXT_SUBTLE,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '600',
  },
});
