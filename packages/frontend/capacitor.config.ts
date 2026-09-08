export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
  };
  plugins?: {
    PushNotifications?: {
      presentationOptions?: string[];
    };
    [key: string]: any;
  };
}

const config: CapacitorConfig = {
  appId: 'pk.edu.apexacademy.erp',
  appName: 'Apex Academy ERP',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
