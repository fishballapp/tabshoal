// The five-fish drawing made for 32–48 px, which suits the 20–32 px the pages show it at.
import markUrl from '../../../../../assets-src/icon-32.svg';

/** The TabShoal mark, a shoal swirling round a sunlit centre: `assets-src/icon-32.svg`. */
export const Mark = ({ size = 20 }: { size?: number }) => (
  <img src={markUrl} width={size} height={size} alt="" />
);
