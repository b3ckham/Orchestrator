export interface Member {
    id: number;
    membershipId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    walletStatus: string;
    gameStatus: string;
    risk_Level: string;
    kyc_Level: string;
    email_Verified: boolean;
    phone_Verified: boolean;
    bonusEligibility: boolean;
    depositEligibility: boolean;
    withdrawalEligibility: boolean;
    bankAccountMgmtLevel: string;
    createdAt: string;
}
