// Single source of truth for the company branding used across every
// customer-facing PDF/Excel export (formal quote print, costing PDF, template tools).
import path from 'path';

export const COMPANY = {
  name: 'AIR SEA WORLDWIDE (VIETNAM) CO., LTD',
  address: '7/F, 92 Yen The street, Ward Tan Son Hoa, Ho Chi Minh city, Vietnam.',
  email: 'tin.ho@asw-hochiminhcity.com.vn',
  phone: '+84 968064737',
};

export const LOGO_PATH = path.join(process.cwd(), 'data', 'assets', 'logo.png');
