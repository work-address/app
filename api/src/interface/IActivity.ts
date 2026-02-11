export interface IActivity {
  id?: string;
  title: string;
  text: any;
  location: string;
  position: string;
  employment: string[];
  keywords: string[];
  salary: string;
  rateHour: number;
  sourceUrl: string;
  jobUrl: string;
  hash: string;
  trackScreenshots?: boolean | null;
  trackProcesses?: boolean | null;
}
