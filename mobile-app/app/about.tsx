// ============================================================
// AgriSweep — About
// The team photo first, then what AgriSweep is, how a cleaning
// works, who built it, and the hardware behind it.
// ============================================================

import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, Modal, Image, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Cpu,
  Zap,
  Settings as Gear,
  Droplets,
  Radar,
  Wind,
  Monitor,
  Plug,
  Camera,
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../constants/theme';
import { APP_CONFIG, HARDWARE_COMPONENTS, WIRING_MAP } from '../constants/config';
import { confirmDestructive, notify } from '../utils/dialogs';

const TEAM_PHOTO = require('../assets/images/team.jpg');

const HARDWARE_ICONS: Record<(typeof HARDWARE_COMPONENTS)[number]['icon'], typeof Cpu> = {
  Cpu,
  Zap,
  Settings: Gear,
  Droplets,
  Radar,
  Wind,
  Monitor,
  Plug,
  Camera,
};

const STEPS = [
  {
    title: 'Watch',
    text: 'A phone camera looks at the cage floor. The MQ-135 smells for ammonia and the HC-SR04 checks how full the waste bin is.',
  },
  {
    title: 'Decide',
    text: 'A cycle starts when you press Start, when the schedule says so, or when the camera is sure it sees droppings. The emergency stop always wins.',
  },
  {
    title: 'Sweep',
    text: 'The ESP32 drives the worm-gear motor through the BTS7960. The belt pulls the scraper the set distance toward the bin, then back home.',
  },
  {
    title: 'Rinse',
    text: 'The relay switches on the 12 V pump to wash the floor once the scraper is home.',
  },
  {
    title: 'Record',
    text: 'Each cycle, reading and event is saved so you can see how the cage was kept over time.',
  },
];

interface Member {
  id: string;
  name: string;
  role: string;
}

const DEFAULT_TEAM: Member[] = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), name: `Member ${n}`, role: 'Tap to add a name and role' }));
const TEAM_STORAGE_KEY = '@agrisweep_contributors';

export default function AboutScreen() {
  const { width } = useWindowDimensions();
  const [team, setTeam] = useState<Member[]>(DEFAULT_TEAM);
  const [editing, setEditing] = useState<Member | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(TEAM_STORAGE_KEY)
      .then((saved) => {
        if (saved) setTeam(JSON.parse(saved) as Member[]);
      })
      .catch(() => {});
  }, []);

  const persist = (next: Member[]) => {
    setTeam(next);
    AsyncStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const openEdit = (m: Member) => {
    setIsNew(false);
    setEditing(m);
    setName(m.name.startsWith('Member ') ? '' : m.name);
    setRole(m.role === DEFAULT_TEAM[0].role ? '' : m.role);
  };

  const openAdd = () => {
    setIsNew(true);
    setEditing({ id: String(Date.now()), name: '', role: '' });
    setName('');
    setRole('');
  };

  const saveMember = () => {
    if (!editing) return;
    if (!name.trim()) {
      notify('Add a name', 'Enter the team member’s name.');
      return;
    }
    const member = { ...editing, name: name.trim(), role: role.trim() || 'Team member' };
    persist(isNew ? [...team, member] : team.map((m) => (m.id === member.id ? member : m)));
    setEditing(null);
  };

  const removeMember = (m: Member) =>
    confirmDestructive('Remove from the team list?', `${m.name} will be removed from the credits.`, 'Remove', () =>
      persist(team.filter((x) => x.id !== m.id))
    );

  const photoHeight = Math.round(((Math.min(width, 640) - Spacing.lg * 2) * 1067) / 1600);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="About"
        subtitle="The project and the people behind it."
        right={
          <Pressable style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} accessibilityRole="button">
            <ChevronLeft size={16} color={Colors.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---- Team photo ---- */}
        <Image
          source={TEAM_PHOTO}
          style={[styles.photo, { height: photoHeight }]}
          resizeMode="cover"
          accessibilityLabel="The AgriSweep team with the scraper frame during the build"
        />
        <Text style={styles.caption}>The AgriSweep team with the scraper frame during the build.</Text>

        {/* ---- What it is ---- */}
        <View style={styles.intro}>
          <Text style={styles.wordmark}>AgriSweep</Text>
          <Text style={styles.lead}>
            AgriSweep cleans chicken droppings from under a cage by itself. A scraper on a belt pushes the waste into a bin, a pump
            rinses the floor, and this app lets you watch and control it from your phone.
          </Text>
          <Text style={styles.body}>
            Cleaning cages by hand is slow, dirty work, and droppings left too long release ammonia that is bad for both the birds and
            the people who care for them. AgriSweep keeps the floor clean on a schedule, or as soon as a camera spots droppings, so
            the air stays fresher and the work takes minutes instead of an afternoon.
          </Text>
        </View>

        {/* ---- How a cleaning works (a real sequence, so it is numbered) ---- */}
        <Card title="How a cleaning works">
          {STEPS.map((step, i) => (
            <View key={step.title} style={[styles.step, i === STEPS.length - 1 && styles.stepLast]}>
              <View style={styles.stepRail}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* ---- Team ---- */}
        <Card title="The team" subtitle="Tap a name to edit it.">
          {team.map((m) => (
            <Pressable key={m.id} style={({ pressed }) => [styles.member, pressed && { opacity: 0.7 }]} onPress={() => openEdit(m)}>
              <View style={styles.initial}>
                <Text style={styles.initialText}>{m.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.role}</Text>
              </View>
              <Pencil size={16} color={Colors.faint} />
              <Pressable onPress={() => removeMember(m)} hitSlop={10} accessibilityLabel={`Remove ${m.name}`}>
                <Trash2 size={16} color={Colors.faint} />
              </Pressable>
            </Pressable>
          ))}
          <Pressable style={styles.addBtn} onPress={openAdd}>
            <Plus size={16} color={Colors.ink} />
            <Text style={styles.addText}>Add team member</Text>
          </Pressable>
        </Card>

        {/* ---- Hardware ---- */}
        <Card title="What it is made of">
          {HARDWARE_COMPONENTS.map((h, i) => {
            const Icon = HARDWARE_ICONS[h.icon];
            return (
              <View key={h.id} style={[styles.part, i === HARDWARE_COMPONENTS.length - 1 && styles.partLast]}>
                <Icon size={18} color={Colors.barn} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.partName}>{h.name}</Text>
                  <Text style={styles.partPins}>{h.pins}</Text>
                  <Text style={styles.partText}>{h.description}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        {/* ---- Wiring ---- */}
        <Card title="ESP32 wiring" subtitle="From the AgriSweep wiring sheet.">
          {WIRING_MAP.map((group) => (
            <View key={group.title} style={styles.wiringGroup}>
              <Text style={styles.wiringTitle}>{group.title}</Text>
              {group.rows.map((row) => (
                <View key={`${group.title}-${row.from}`} style={styles.wiringRow}>
                  <Text style={styles.wiringFrom}>{row.from}</Text>
                  <Text style={styles.wiringTo}>{row.to}</Text>
                  <Text style={styles.wiringNote}>{row.note ?? ''}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.warning}>Unplug 12 V and USB before changing wires. 12 V must never touch an ESP32 pin.</Text>
        </Card>

        <Text style={styles.footer}>
          AgriSweep {APP_CONFIG.version}. ESP32-WROOM, Firebase Realtime Database and Expo.
        </Text>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>{isNew ? 'Add team member' : 'Edit team member'}</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={Colors.faint} autoFocus />
            <Text style={styles.label}>Role</Text>
            <TextInput
              style={styles.input}
              value={role}
              onChangeText={setRole}
              placeholder="e.g. Wiring and firmware"
              placeholderTextColor={Colors.faint}
            />
            <View style={styles.dialogActions}>
              <Pressable style={[styles.dialogBtn, styles.cancel]} onPress={() => setEditing(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.dialogBtn, styles.save]} onPress={saveMember}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.steel,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink },

  photo: { width: '100%', borderRadius: BorderRadius.xl, backgroundColor: Colors.sunken },
  caption: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint, marginTop: Spacing.sm, paddingHorizontal: Spacing.xs },

  intro: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  wordmark: { fontFamily: Fonts.display, fontSize: FontSize.display, lineHeight: FontSize.display, color: Colors.ink, letterSpacing: 0.3 },
  lead: { fontFamily: Fonts.bold, fontSize: FontSize.lg, lineHeight: 27, color: Colors.ink, marginTop: Spacing.md },
  body: { fontFamily: Fonts.regular, fontSize: FontSize.md, lineHeight: 25, color: Colors.muted, marginTop: Spacing.md },

  step: { flexDirection: 'row', gap: Spacing.md, paddingBottom: Spacing.lg },
  stepLast: { paddingBottom: 0 },
  stepRail: { alignItems: 'center', width: 30 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    color: Colors.straw,
    textAlign: 'center',
    lineHeight: 30,
    fontFamily: Fonts.display,
    fontSize: FontSize.lg,
    overflow: 'hidden',
  },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.line, marginTop: 4 },
  stepBody: { flex: 1, paddingTop: 3 },
  stepTitle: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.ink },
  stepText: { fontFamily: Fonts.regular, fontSize: FontSize.sm, lineHeight: 21, color: Colors.muted, marginTop: 2 },

  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lineSoft,
  },
  initial: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.barnTint, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: Fonts.display, fontSize: FontSize.lg, color: Colors.barn },
  memberName: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.ink },
  memberRole: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint, marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
  },
  addText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink },

  part: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.lineSoft },
  partLast: { borderBottomWidth: 0, paddingBottom: 0 },
  partName: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink },
  partPins: { fontFamily: Fonts.bold, fontSize: FontSize.xs, color: Colors.barn, marginTop: 2 },
  partText: { fontFamily: Fonts.regular, fontSize: FontSize.xs, lineHeight: 18, color: Colors.muted, marginTop: 4 },

  wiringGroup: { marginBottom: Spacing.md },
  wiringTitle: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink, marginBottom: 4 },
  wiringRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.lineSoft },
  wiringFrom: { width: 84, fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.ink },
  wiringTo: { width: 110, fontFamily: Fonts.bold, fontSize: FontSize.xs, color: Colors.barn },
  wiringNote: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint },
  warning: { fontFamily: Fonts.bold, fontSize: FontSize.xs, lineHeight: 18, color: Colors.combDark },

  footer: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint, textAlign: 'center', marginTop: Spacing.lg },

  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: Spacing.xl },
  dialog: { backgroundColor: Colors.steel, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxWidth: 400, alignSelf: 'center' },
  dialogTitle: { fontFamily: Fonts.display, fontSize: FontSize.xxl, color: Colors.ink, marginBottom: Spacing.sm },
  label: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink, marginTop: Spacing.md, marginBottom: 6 },
  input: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Colors.ink,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  dialogActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  dialogBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: BorderRadius.md },
  cancel: { backgroundColor: Colors.sunken },
  save: { backgroundColor: Colors.ink },
  cancelText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.muted },
  saveText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: '#FFFFFF' },
});
