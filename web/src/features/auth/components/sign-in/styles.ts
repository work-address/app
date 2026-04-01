import styled from 'styled-components'

export const Stage = styled.main`
  min-height: 100vh;
  background: url('/img/photo/sign-bg.webp') center / cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

export const Logo = styled.img`
  height: 40px;
  width: auto;
  display: block;
  margin-bottom: 22px;
`

export const Card = styled.section`
  width: 600px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
  padding: 22px;
  text-align: center;
  height: 476px;
`

export const Title = styled.h1`
  font-weight: 700;
  font-size: 22px;
  line-height: 140%;
  letter-spacing: 0em;
  color: #1c2024;
  margin: 0 0 10px;
`

export const Desc = styled.p`
  font-weight: 400;
  font-size: 14px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.62);
  margin: 0 0 16px;
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`

export const ProviderBtn = styled.button`
  width: 100%;
  height: 46px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 51, 0.12);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;

  &:hover {
    background: rgba(0, 0, 51, 0.02);
  }
`

export const ProviderIcon = styled.img`
  width: 26px;
  height: 26px;
  display: block;
`

export const ProviderText = styled.div`
  font-weight: 500;
  font-size: 14px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.82);
`

export const Learn = styled.button`
  background: transparent;
  border: 0;
  color: #3f67a4;
  font-weight: 500;
  font-size: 12px;
  line-height: 150%;
  padding: 6px 0 0;

  &:hover {
    text-decoration: underline;
  }
`

export const Foot = styled.footer`
  width: min(680px, 100%);
  text-align: center;
  font-size: 11px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.52);
  margin-top: 18px;
`

export const FootLine = styled.div`
  margin-top: 8px;
`

export const FootLabel = styled.span`
  font-weight: 600;
`

export const HiddenButtonRow = styled.div`
  display: none;
`
