# 기존 렌더러의 원화

기존 원본 아트와 마스크를 수정 없이 보존했다. `normal-base.png`와 런타임 채널은 96×96, `source-art.png`는 그 이전의 큰 작업 원화다. 출처·색상·영역 정보는 `manifest.json`, 원본 파일 해시는 프로젝트 `provenance/source-manifest.json`에 있다.

프로젝트 루트에서:

```sh
npm run art:check     # 읽기 전용: PNG와 생성된 런타임 데이터 비교
npm run art:compile   # 검토한 PNG에서 src/core/engine/art-data.ts 재생성
```

기준 원화를 새 디자인처럼 수정하거나 자동 준비 단계로 덮어쓰지 않는다. 새로운 외형 실험용 아트는 별도 디렉터리에 두고 렌더러 어댑터로 연결한다. 픽셀 출력은 96×96이며 확대에는 최근접 표시만 사용한다. 기존 아트의 출처·해상도 한계를 새 수작업 원화라고 설명하지 않는다.
