export interface IText {
  url: string;
  title: string;
  text: {
    plain: string;
    html: string;
  };
  error: string;
  html: string;
}
