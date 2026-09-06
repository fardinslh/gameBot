'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Crown, MoreVertical, ShieldAlert, Trophy, UserCheck, UserMinus } from 'lucide-react';
import type { GuildMemberInfo, GuildRole } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { LeagueBadge } from '@/features/leaderboard/components/league-badge';

interface GuildRosterViewProps {
  members: GuildMemberInfo[];
  currentUserRole: GuildRole | null;
  currentUserId?: string;
  dictionary: Dictionary;
  onKick(memberId: string): Promise<boolean>;
  onSetRole(memberId: string, role: 'OFFICER' | 'MEMBER'): Promise<boolean>;
  pending: boolean;
}

export function GuildRosterView({
  members,
  currentUserRole,
  currentUserId,
  dictionary: t,
  onKick,
  onSetRole,
  pending,
}: GuildRosterViewProps) {
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  const canManage = currentUserRole === 'LEADER' || currentUserRole === 'OFFICER';

  return (
    <div className="guild-roster-view">
      <div className="guild-roster-header">
        <span>{t.guildUi.members} ({members.length} / 50)</span>
        <small>{t.guildUi.donationsResetWeekly}</small>
      </div>

      <div className="guild-roster-list">
        {members.map((member) => {
          const isSelf = member.playerId === currentUserId;
          const canKickThisMember =
            canManage &&
            !isSelf &&
            (currentUserRole === 'LEADER' ||
              (currentUserRole === 'OFFICER' && member.role === 'MEMBER'));
          const canPromoteThisMember = currentUserRole === 'LEADER' && !isSelf;

          return (
            <div
              key={member.playerId}
              className={`guild-member-row ${isSelf ? 'guild-member-row--self' : ''}`}
            >
              {/* Avatar & Role Badge */}
              <div className="guild-member-avatar-wrap">
                <span className={`guild-member-avatar guild-member-avatar--${member.role.toLowerCase()}`}>
                  {member.role === 'LEADER' ? (
                    <Crown size={15} />
                  ) : member.role === 'OFFICER' ? (
                    <ShieldAlert size={14} />
                  ) : (
                    <UserCheck size={14} />
                  )}
                </span>
              </div>

              {/* Name & Title */}
              <div className="guild-member-info">
                <div className="guild-member-name-row">
                  <strong><BidiValue>{member.displayName}</BidiValue></strong>
                  <span className={`guild-role-tag guild-role-tag--${member.role.toLowerCase()}`}>
                    {t.guildUi.roles[member.role]}
                  </span>
                </div>
                <small>
                  {t.guildUi.castle} Lv. <BidiValue direction="ltr">{member.castleLevel}</BidiValue>
                </small>
              </div>

              {/* Trophies & League */}
              <div className="guild-member-trophies">
                <LeagueBadge league={member.league} size="sm" />
                <span>
                  <Trophy size={12} /> <BidiValue direction="ltr">{member.trophies}</BidiValue>
                </span>
              </div>

              {/* Donations */}
              <div className="guild-member-donations" title={t.guildUi.donationsTitle}>
                <span className="guild-donations-stat" title={t.guildUi.donationsGiven}>
                  <ArrowUp size={11} /> <BidiValue direction="ltr">{member.donationsGiven}</BidiValue>
                </span>
                <span className="guild-donations-stat guild-donations-stat--received" title={t.guildUi.donationsReceived}>
                  <ArrowDown size={11} /> <BidiValue direction="ltr">{member.donationsReceived}</BidiValue>
                </span>
              </div>

              {/* Manage Action */}
              {(canKickThisMember || canPromoteThisMember) ? (
                <div className="guild-member-actions-wrap">
                  <button
                    aria-label={t.guildUi.manageMember}
                    className="guild-member-more-btn"
                    onClick={() =>
                      setActiveMenuMemberId(
                        activeMenuMemberId === member.playerId ? null : member.playerId,
                      )
                    }
                    type="button"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenuMemberId === member.playerId ? (
                    <div className="guild-member-menu">
                      {canPromoteThisMember ? (
                        member.role === 'OFFICER' ? (
                          <button
                            disabled={pending}
                            onClick={() => {
                              void onSetRole(member.playerId, 'MEMBER');
                              setActiveMenuMemberId(null);
                            }}
                            type="button"
                          >
                            <UserCheck size={14} /> {t.guildUi.demoteToMember}
                          </button>
                        ) : (
                          <button
                            disabled={pending}
                            onClick={() => {
                              void onSetRole(member.playerId, 'OFFICER');
                              setActiveMenuMemberId(null);
                            }}
                            type="button"
                          >
                            <ShieldAlert size={14} /> {t.guildUi.promoteToOfficer}
                          </button>
                        )
                      ) : null}

                      {canKickThisMember ? (
                        <button
                          className="guild-menu-btn--danger"
                          disabled={pending}
                          onClick={() => {
                            void onKick(member.playerId);
                            setActiveMenuMemberId(null);
                          }}
                          type="button"
                        >
                          <UserMinus size={14} /> {t.guildUi.kick}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
