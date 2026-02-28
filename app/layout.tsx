 import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { Roboto } from 'next/font/google';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';
import './globals.css'
import PrimarySearchAppBar from './components/PrimarySearchAppBar'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

 export default function RootLayout(props) {
   const { children } = props;
   return (
    <html lang="en" className={roboto.className}>
       <body>
          <AppRouterCacheProvider>
           <ThemeProvider theme={theme}>
              <PrimarySearchAppBar/>
              {children}
           </ThemeProvider>
          </AppRouterCacheProvider>
       </body>
     </html>
   );
 }
