/* ==========================================================================
   Device registry for House Control.

   This is the file to edit once real device IDs are known (from the Tuya
   IoT Console, SmartThings API, or the LG ThinQ developer site). Nothing
   here is fetched from a server — it's the map the dashboard uses to know
   what exists, which floor/room it's in, and which platform's API to call.

   `platform` must match a key in HC_PLATFORMS below.
   `id` should become the real device ID from that platform once connected;
   until then it's just a demo key and control stays local to the browser.
   ========================================================================== */

window.HC_PLATFORMS = {
  tuya: {
    label: 'Tuya',
    color: '#E8A33D',
    manual: false,
    note: 'Controlled via the Tuya Cloud API through your proxy.'
  },
  lg: {
    label: 'LG ThinQ',
    color: '#E2604A',
    manual: false,
    note: 'Controlled via the LG ThinQ Connect API through your proxy.'
  },
  smartthings: {
    label: 'SmartThings',
    color: '#4FA6E8',
    manual: false,
    note: 'Controlled via the SmartThings API through your proxy.'
  },
  philips: {
    label: 'Philips Coolhome',
    color: '#2E93A6',
    manual: true,
    note: 'Philips Coolhome has no public developer API. This tile is for reference — set it from the Coolhome app.'
  },
  eureka: {
    label: 'Eureka',
    color: '#8862D6',
    manual: true,
    note: 'Eureka has no public developer API. This tile is for reference — set it from the eureka robot app.'
  }
};

window.HC_DEVICES = [
  // ---- First floor ----
  { id: 'lr-ac',        floor: 1, room: 'Living Room',  name: 'Living Room AC',     platform: 'lg',          type: 'ac',     state: { on: true,  temp: 23 } },
  { id: 'lr-light',     floor: 1, room: 'Living Room',  name: 'Ceiling Light',      platform: 'tuya',        type: 'light',  state: { on: true,  brightness: 80 } },
  { id: 'lr-vacuum',    floor: 1, room: 'Living Room',  name: 'Robot Vacuum',       platform: 'eureka',      type: 'vacuum', state: { on: false, status: 'Docked' } },
  { id: 'kitchen-light',floor: 1, room: 'Kitchen',      name: 'Kitchen Light',      platform: 'tuya',        type: 'light',  state: { on: false, brightness: 100 } },
  { id: 'kitchen-plug', floor: 1, room: 'Kitchen',      name: 'Coffee Machine',     platform: 'smartthings', type: 'plug',   state: { on: false } },
  { id: 'dining-ac',    floor: 1, room: 'Dining Room',  name: 'Dining Room AC',     platform: 'philips',     type: 'ac',     state: { on: false, temp: 24 } },
  { id: 'entry-light',  floor: 1, room: 'Entrance',     name: 'Entrance Light',     platform: 'tuya',        type: 'light',  state: { on: true,  brightness: 45 } },

  // ---- Second floor ----
  { id: 'master-ac',    floor: 2, room: 'Parents Master Bedroom', name: 'Parents Bedroom AC', platform: 'lg',          type: 'ac',    state: { on: true,  temp: 22 } },
  { id: 'master-light', floor: 2, room: 'Parents Master Bedroom', name: 'Bedside Lights',      platform: 'tuya',        type: 'light', state: { on: false, brightness: 30 } },
  { id: 'guest-ac',     floor: 2, room: 'Kids Master Bedroom',    name: 'Kids Bedroom AC',      platform: 'philips',     type: 'ac',    state: { on: false, temp: 24 } },
  { id: 'office-light', floor: 2, room: 'Office',         name: 'Office Light',      platform: 'tuya',        type: 'light', state: { on: true,  brightness: 60 } },
  { id: 'office-plug',  floor: 2, room: 'Office',         name: 'Desk Plug',         platform: 'smartthings', type: 'plug',  state: { on: true } },
  { id: 'bath-light',   floor: 2, room: 'Bathroom',       name: 'Bathroom Light',    platform: 'tuya',        type: 'light', state: { on: false, brightness: 100 } }
];
