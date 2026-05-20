export type CategoryOption = {
  label: string;
  code: string | null;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { label: '전체', code: null },
  { label: '음식점', code: 'FD6' },
  { label: '카페', code: 'CE7' },
  { label: '편의점', code: 'CS2' },
  { label: '대형마트', code: 'MT1' },
  { label: '약국', code: 'PM9' },
  { label: '병원', code: 'HP8' },
  { label: '기타', code: null },
  { label: '공공기관', code: 'PO3' },
  { label: '문화시설', code: 'CT1' },
  { label: '학교', code: 'SC4' },
  { label: '지하철역', code: 'SW8' },
  { label: '주차장', code: 'PK6' },
];

export const CATEGORY_LABELS = CATEGORY_OPTIONS.map((option) => option.label);

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  음식점: ['음식점', '식당', '맛집', '분식', '한식', '중식', '일식', '양식', '패스트푸드', '치킨', '피자', '햄버거'],
  카페: ['카페', '커피', '디저트', '베이커리'],
  편의점: ['편의점'],
  대형마트: ['대형마트', '마트', '슈퍼'],
  약국: ['약국'],
  병원: ['병원', '의원', '클리닉'],
  공공기관: ['공공기관', '관공서', '행정복지센터', '주민센터', '구청', '시청', '동사무소'],
  문화시설: ['문화시설', '도서관', '미술관', '박물관', '극장', '공연장'],
  학교: ['학교', '초등학교', '중학교', '고등학교', '대학교'],
  지하철역: ['지하철역', '역'],
  주차장: ['주차장', '주차타워', '주차빌딩', '파킹'],
  기타: ['기타'],
};
