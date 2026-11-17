import { useState } from 'react';
import { useGameController } from '../app/ControllerContext';
import { MAX_PROFILES, TOTAL_WAVES } from '../game/domain/types';
import type { AppSnapshot } from '../app/controller';
import type { ProfileSummary } from '../persistence/indexeddb/profileRepository';
import { t } from '../localization';
import { Icon } from './Icon';
import { Modal } from './Modal';

function ProfileCard({
  profile,
  isActive,
  onSelect,
  onDelete,
}: {
  profile: ProfileSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`profile-card panel${profile.corrupt ? ' profile-card--corrupt' : ''}${
        isActive ? ' profile-card--active' : ''
      }`}
      data-testid={`profile-card-${profile.profileId}`}
    >
      <div className="profile-card__top">
        <div className="profile-avatar profile-avatar--small" aria-hidden="true">
          {profile.corrupt ? '!' : profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h3 className="profile-card__name">
            {profile.corrupt ? t('profileCorrupt') : profile.name}
          </h3>
          <p className="profile-card__meta">
            {profile.corrupt
              ? t('profileCorruptHint')
              : t('waveLabel', { wave: profile.currentWave })}
          </p>
        </div>
        {isActive ? <span className="status-chip">{t('activeProfile')}</span> : null}
      </div>
      <div className="profile-card__stats">
        <span>
          <Icon name="coin" size={16} /> {profile.coins}
        </span>
        <span>
          <Icon name="enemy-wave" size={16} /> {profile.currentWave}/{TOTAL_WAVES}
        </span>
      </div>
      <div className="profile-card__actions">
        {!profile.corrupt ? (
          <button
            type="button"
            className="button button--primary button--compact"
            onClick={onSelect}
            data-testid={`select-profile-${profile.profileId}`}
          >
            {isActive ? t('menuContinue') : t('selectProfile')}
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger-ghost button--compact"
          onClick={onDelete}
          aria-label={t('ariaDeleteProfile')}
        >
          {t('profileDelete')}
        </button>
      </div>
    </article>
  );
}

export function ProfileScreen({ snapshot }: { snapshot: AppSnapshot }) {
  const controller = useGameController();
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProfileSummary | null>(null);
  const profiles = snapshot.profiles;
  const activeId = snapshot.activeProfile?.profileId ?? null;
  const canCreate = profiles.length < MAX_PROFILES;
  const creating = snapshot.creatingProfile;

  return (
    <main className="profiles-screen">
      <div className="menu-glow menu-glow--purple" aria-hidden="true" />
      <header className="page-header">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => controller.closeProfiles()}
        >
          <Icon name="arrow-left" size={18} />
          {t('back')}
        </button>
        <div>
          <p className="eyebrow">{t('menuProfiles')}</p>
          <h1 className="page-title">{t('profilesTitle')}</h1>
        </div>
        <div className="page-header__spacer" />
      </header>

      <p className="page-subtitle">{t('profilesSubtitle')}</p>

      <section className="profiles-grid" data-testid="profiles-screen">
        {Array.from({ length: MAX_PROFILES }, (_, index) => {
          const profile = profiles[index];
          if (profile) {
            return (
              <ProfileCard
                key={profile.profileId}
                profile={profile}
                isActive={profile.profileId === activeId}
                onSelect={() => void controller.selectProfile(profile.profileId)}
                onDelete={() => setDeleteTarget(profile)}
              />
            );
          }
          if (index === profiles.length && canCreate) {
            return (
              <form
                key={`create-${index}`}
                className="profile-card panel profile-card--new"
                onSubmit={(event) => {
                  event.preventDefault();
                  void controller.createProfile(name);
                }}
              >
                <div className="profile-card__top">
                  <div
                    className="profile-avatar profile-avatar--small profile-avatar--empty"
                    aria-hidden="true"
                  >
                    +
                  </div>
                  <div>
                    <h3 className="profile-card__name">{t('profileNew')}</h3>
                    <p className="profile-card__meta">{t('profileSlot', { index: index + 1 })}</p>
                  </div>
                </div>
                <label className="field">
                  <span className="field__label">{t('profileNameLabel')}</span>
                  <input
                    className="text-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('profileNamePlaceholder')}
                    maxLength={24}
                    autoComplete="off"
                    disabled={creating}
                    data-testid="new-profile-name"
                  />
                </label>
                <button
                  type="submit"
                  className="button button--primary button--compact"
                  disabled={creating}
                  aria-busy={creating}
                  data-testid="create-profile"
                >
                  <Icon name="check" size={18} />
                  {creating ? t('creatingProfileLabel') : t('createProfile')}
                </button>
              </form>
            );
          }
          return (
            <div key={`empty-${index}`} className="profile-card panel profile-card--empty-slot">
              <div className="profile-card__top">
                <div
                  className="profile-avatar profile-avatar--small profile-avatar--empty"
                  aria-hidden="true"
                >
                  {index + 1}
                </div>
                <div>
                  <h3 className="profile-card__name">{t('profileEmpty')}</h3>
                  <p className="profile-card__meta">{t('profileSlot', { index: index + 1 })}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {!snapshot.storageAvailable ? (
        <div className="warning-banner" role="alert">
          <Icon name="warning" size={18} />
          <span>{t('storageWarning')}</span>
        </div>
      ) : null}

      {deleteTarget ? (
        <Modal
          title={t('profileDelete')}
          tone="danger"
          size="small"
          onClose={() => setDeleteTarget(null)}
          testId="delete-profile-modal"
        >
          <p className="modal-text">{t('profileDeleteConfirm')}</p>
          <div className="modal-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDeleteTarget(null)}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                void controller.deleteProfile(target.profileId);
              }}
            >
              {t('profileDelete')}
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
