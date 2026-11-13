export const processgetEmailTemplates = (clientInfo, userData) => [
    {
      id: "welcome",
      name: "Welcome Email",
      subject: "Welcome to Ad Agency 360",
      body: `Hello ${clientInfo.name},
  
  Welcome to Ad Agency 360! We're excited to have you on board and look forward to building a successful relationship.
  
  If you have any questions or need assistance, feel free to reach out.
  
  Best regards,  
  ${userData.fullName}`,
    },
    {
      id: "followup",
      name: "Follow-Up Email",
      subject: "Following Up On Our Recent Conversation",
      body: `Hi ${clientInfo.name},
  
  It was a pleasure speaking with you earlier. I just wanted to follow up on our discussion and see if you had any further questions or feedback.
  
  Let me know how you'd like to proceed, and I’d be happy to assist.
  
  Warm regards,  
  ${userData.fullName}`,
    },
    {
      id: "product_update",
      name: "Product Update",
      subject: "Exciting Updates from Ad Agency 360",
      body: `Dear ${clientInfo.name},
  
  We’ve recently rolled out some exciting updates to our services based on user feedback!
  
  Some key improvements:
  - Faster visa processing
  - Enhanced document tracking
  - New customer dashboard features
  
  Log in today to check them out, and let us know what you think.
  
  Sincerely,  
  ${userData.fullName}`,
    },
    {
      id: "feedback_request",
      name: "Feedback Request",
      subject: "We’d Love Your Feedback",
      body: `Hello ${clientInfo.name},
  
  At Ad Agency 360, your opinion means a lot to us. We’d appreciate it if you could take a minute to share your experience with our service.
  
  Your feedback helps us improve and serve you better.
  
  Thank you in advance!  
  ${userData.fullName}`,
    },
  ];