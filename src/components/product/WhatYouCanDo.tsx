import { Document, Email, Reply, WarningAlt } from '@carbon/icons-react';
import type { ApplicationStatus } from '../../contracts/application';
import { StatusBadge } from '../ApplicationStatus';
import { FakeOfferTag } from '../mails/FakeOffer';
import { Band, BandTitle, Tile, Tiles } from './ProductParts';

/** The statuses an application moves through, as tags in the Applications tile. */
const SHOWN_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'RECRUITER_CONTACT',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
];

/** The four things a user does every day; nothing the app does not have today. */
export function WhatYouCanDo() {
  return (
    <Band labelledBy="what-you-can-do">
      <BandTitle
        id="what-you-can-do"
        title="What you can do"
        lead="The four things you use every day."
      />
      <Tiles>
        <Tile icon={Email} title="Mails">
          Every job mail with its next step. It says <i>Needs action</i> until you reply or mark it
          done.
        </Tile>
        <Tile
          icon={Document}
          title="Applications"
          example={SHOWN_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        >
          Each job in one place, with its status and history, kept up to date from your mails.
        </Tile>
        <Tile icon={Reply} title="Reply from the app">
          Write your reply, or let the AI write a draft for you to change. It is sent from your
          Gmail only when you press Send.
        </Tile>
        <Tile icon={WarningAlt} title="Fake offer warning" example={<FakeOfferTag />}>
          If a mail asks you to pay to get a job, NorthList marks it. The mail stays, and you
          decide.
        </Tile>
      </Tiles>
    </Band>
  );
}
