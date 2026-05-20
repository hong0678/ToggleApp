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
  height?: number;
};

const KAKAO_MAP_APP_KEY = '2d21c1757f136b1ff4079ef80c900b15';

export function MiniKakaoMapPreview({ places, height = 190 }: MiniKakaoMapPreviewProps) {
  const validPlaces = useMemo(
    () => places.filter((place) => typeof place.latitude === 'number' && typeof place.longitude === 'number'),
    [places]
  );

  const html = useMemo(() => {
    const serializedPlaces = JSON.stringify(validPlaces.map((place) => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    })));

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
              background: #e8f5f3;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var places = ${serializedPlaces};

            function createMarkerImage(index) {
              var svg = [
                '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">',
                '<path d="M17 44s12-14.2 12-24.1C29 11.7 23.6 6 17 6S5 11.7 5 19.9C5 29.8 17 44 17 44Z" fill="#0ea5a4"/>',
                '<circle cx="17" cy="19" r="8" fill="#ffffff"/>',
                '<text x="17" y="22.5" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" fill="#0ea5a4">',
                String(index + 1),
                '</text>',
                '</svg>',
              ].join('');

              return new kakao.maps.MarkerImage(
                'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                new kakao.maps.Size(34, 46),
                { offset: new kakao.maps.Point(17, 42) }
              );
            }

            function initMap() {
              var centerPlace = places[0] || { latitude: 37.5665, longitude: 126.9780 };
              var map = new kakao.maps.Map(document.getElementById('map'), {
                center: new kakao.maps.LatLng(centerPlace.latitude, centerPlace.longitude),
                level: places.length > 1 ? 6 : 4,
                draggable: false,
                scrollwheel: false,
                disableDoubleClickZoom: true
              });

              map.setDraggable(false);
              map.setZoomable(false);

              if (!places.length) return;

              var bounds = new kakao.maps.LatLngBounds();

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

              if (places.length > 1) {
                map.setBounds(bounds, 30, 30, 30, 30);
              } else {
                map.setCenter(new kakao.maps.LatLng(places[0].latitude, places[0].longitude));
              }
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
  }, [validPlaces]);

  if (validPlaces.length === 0) {
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
        <Text style={styles.countBadgeText}>{validPlaces.length}개 장소</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8eceb',
    backgroundColor: '#e8f5f3',
  },
  webView: {
    flex: 1,
    backgroundColor: '#e8f5f3',
  },
  countBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countBadgeText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyMap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8eceb',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyMapTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyMapText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '600',
  },
});
