function numericPathId(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return String(value);
}

const trayDto = (tray) => tray.map(({ breadId, tagIds }) => ({
  breadId,
  tagIds: [...tagIds],
}));

const reviewDto = ({
  bakeryId,
  recommendationResultId,
  visitDate,
  rating,
  breads,
  customBreadNames,
}) => ({
  bakeryId,
  recommendationResultId,
  visitDate,
  rating,
  breads: breads.map(({ breadId, tagIds }) => ({ breadId, tagIds: [...tagIds] })),
  customBreadNames: [...customBreadNames],
});

export function createEndpoints(client) {
  if (!client?.request) throw new TypeError('createEndpoints requires an API client.');

  return {
    catalog({ signal } = {}) {
      return client.request('/breads', { auth: false, signal });
    },

    homeBakeries({ size = 3, signal } = {}) {
      const query = new URLSearchParams({ size: String(size) });
      return client.request(`/bakeries/home?${query}`, { auth: false, signal });
    },

    signup({ nickname, email, password, passwordConfirm, termsAgreed, privacyAgreed }, { signal } = {}) {
      return client.request('/auth/signup', {
        method: 'POST',
        body: { nickname, email, password, passwordConfirm, termsAgreed, privacyAgreed },
        auth: false,
        refresh: false,
        signal,
      });
    },

    login({ email, password }, { signal } = {}) {
      return client.request('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
        refresh: false,
        sessionGuard: true,
        signal,
      });
    },

    google({ idToken }, { signal } = {}) {
      return client.request('/auth/google', {
        method: 'POST',
        body: { idToken },
        auth: false,
        refresh: false,
        sessionGuard: true,
        signal,
      });
    },

    refresh({ refreshToken }, { signal } = {}) {
      return client.request('/auth/token/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
        refresh: false,
        signal,
      });
    },

    logout({ signal } = {}) {
      return client.request('/auth/logout', { method: 'POST', refresh: false, signal });
    },

    me({ signal } = {}) {
      return client.request('/users/me', { signal });
    },

    recommend(tray, { signal } = {}) {
      return client.request('/recommendations', {
        method: 'POST',
        body: { tray: trayDto(tray) },
        signal,
      });
    },

    history({ signal } = {}) {
      return client.request('/users/me/recommendations', { signal });
    },

    bakeryDetail(bakeryId, { signal } = {}) {
      return client.request(`/bakeries/${numericPathId(bakeryId, 'bakeryId')}`, { signal });
    },

    // Aggregated per-bread tag counts for the result card; public like the other bakery reads.
    bakeryProfile(bakeryId, { signal } = {}) {
      return client.request(`/bakeries/${numericPathId(bakeryId, 'bakeryId')}/profile`, { auth: false, signal });
    },

    bookmarks({ signal } = {}) {
      return client.request('/users/me/bookmarks', { signal });
    },

    toggleBookmark(bakeryId, { signal } = {}) {
      return client.request(`/bakeries/${numericPathId(bakeryId, 'bakeryId')}/bookmark`, {
        method: 'POST',
        signal,
      });
    },

    createReview(input, { signal } = {}) {
      return client.request('/reviews', {
        method: 'POST',
        body: reviewDto(input),
        signal,
      });
    },

    myReviews({ signal } = {}) {
      return client.request('/users/me/reviews', { signal });
    },

    ranking({ period = 'monthly', yearMonth, signal } = {}) {
      const query = new URLSearchParams({ period });
      if (yearMonth) query.set('yearMonth', yearMonth);
      return client.request(`/rankings?${query}`, { signal });
    },
  };
}
