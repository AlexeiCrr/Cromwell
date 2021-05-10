import '@testing-library/jest-dom/extend-expect';

import { setStoreItem } from '@cromwell/core';

setStoreItem('cmsSettings', {
    mainApiPort: 1,
    adminPanelPort: 2,
    frontendPort: 3,
    managerPort: 4,
})